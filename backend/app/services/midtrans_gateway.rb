require "digest"
require "logger"
require "veritrans"

class MidtransGateway
  API_HOST = "https://api.sandbox.midtrans.com"
  ENVIRONMENT = "sandbox"

  class ConfigurationError < StandardError
  end

  class ProviderError < StandardError
  end

  def initialize
    environment = ENV.fetch("MIDTRANS_ENV", ENVIRONMENT)
    unless environment == ENVIRONMENT
      raise ConfigurationError, "Integrasi Midtrans hanya diaktifkan untuk Sandbox."
    end

    @server_key = ENV["MIDTRANS_SERVER_KEY"].presence
    @client_key = ENV["MIDTRANS_CLIENT_KEY"].presence
    unless @server_key && @client_key
      raise ConfigurationError, "MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY wajib dikonfigurasi."
    end

    @client = Midtrans.new(
      server_key: @server_key,
      client_key: @client_key,
      api_host: API_HOST,
      http_options: { connect_timeout: 5, read_timeout: 10, write_timeout: 10 }
    )
    @null_logger = Logger.new(File::NULL)
    @null_logger.level = Logger::FATAL
    @client.logger = @null_logger
    @client.file_logger = @null_logger
  end

  attr_reader :client_key

  def create_snap(payment:, customer:)
    @client.config.idempotency_key = "payment-#{payment.reference}"
    response = @client.create_snap_token(
      transaction_details: {
        order_id: payment.reference,
        gross_amount: payment.amount.to_i
      },
      customer_details: customer_details(customer)
    )
    unless response.success? && response.token.present? && response.redirect_url.present?
      raise ProviderError, "Midtrans tidak mengembalikan token checkout yang valid."
    end

    { token: response.token, redirect_url: response.redirect_url }
  rescue MidtransError, Excon::Error => error
    Rails.logger.error("Midtrans Snap request failed (#{error.class}).")
    raise ProviderError, "Midtrans Sandbox tidak dapat memproses checkout."
  end

  def status(provider_order_id)
    response = @client.status(provider_order_id)
    unless response.success?
      raise ProviderError, "Midtrans gagal memverifikasi status pembayaran."
    end

    response.data.stringify_keys
  rescue MidtransError, Excon::Error => error
    Rails.logger.error("Midtrans status request failed (#{error.class}).")
    raise ProviderError, "Status pembayaran belum dapat diverifikasi oleh Midtrans."
  end

  def valid_signature?(notification)
    required = %w[order_id status_code gross_amount signature_key]
    return false unless required.all? do |key|
      notification[key].is_a?(String) && notification[key].present?
    end
    return false unless notification["signature_key"].match?(/\A[0-9a-f]{128}\z/i)

    expected = Digest::SHA512.hexdigest(
      "#{notification['order_id']}#{notification['status_code']}#{notification['gross_amount']}#{@server_key}"
    )
    ActiveSupport::SecurityUtils.secure_compare(expected, notification["signature_key"])
  end

  private

  def customer_details(customer)
    details = { first_name: customer.name.to_s.truncate(50) }
    details[:email] = customer.email if customer.email.present?
    details[:phone] = customer.phone if customer.phone.present?
    details
  end
end
