class Payment < ApplicationRecord
  METHODS = %w[cash gateway qris].freeze
  STATUSES = %w[pending succeeded failed refunded].freeze
  MAX_AMOUNT = BigDecimal("999999999999.99")
  SERIALIZED_FIELDS = %i[
    id amount currency method status paid_at reference cash_received change_amount
    provider provider_reference expires_at created_by_id confirmed_by_id created_at
  ].freeze

  class InvalidPayment < StandardError
    attr_reader :code, :status

    def initialize(code, message, status = :unprocessable_entity)
      @code = code
      @status = status
      super(message)
    end
  end

  def apply_midtrans_status!(provider_status)
    raise ArgumentError, "Payment bukan transaksi Midtrans." unless method == "gateway" && provider == "midtrans"

    data = provider_status.stringify_keys
    unless data["order_id"] == reference &&
        BigDecimal(data.fetch("gross_amount").to_s) == amount &&
        data["currency"] == currency
      raise MidtransGateway::ProviderError, "Data status Midtrans tidak cocok dengan Payment."
    end

    remote_status = data.fetch("transaction_status")
    next_status = case remote_status
    when "settlement"
      "succeeded"
    when "capture"
      data["fraud_status"] == "accept" ? "succeeded" : "pending"
    when "pending"
      "pending"
    when "expire", "cancel", "deny", "failure", "chargeback"
      "failed"
    when "refund"
      "refunded"
    when "partial_refund", "partial_chargeback"
      Rails.logger.error("Midtrans returned unsupported partial reversal for Payment #{id}.")
      return false
    else
      Rails.logger.warn("Midtrans returned unsupported transaction status for Payment #{id}.")
      return false
    end

    if status == "succeeded" && next_status == "pending"
      return false
    end
    if status == "failed" && next_status == "pending"
      return false
    end
    if next_status == "succeeded" && (order&.status == "cancelled" || rental&.status == "cancelled")
      Rails.logger.error("Late Midtrans payment succeeded for cancelled transaction; manual review required for Payment #{id}.")
    elsif status == "succeeded" && next_status == "failed"
      Rails.logger.error("Midtrans reported a reversal for Payment #{id}.")
    end

    attributes = {
      status: next_status,
      provider_transaction_status: remote_status,
      provider_reference: data["transaction_id"].presence || provider_reference
    }
    if next_status == "succeeded"
      attributes[:paid_at] = parse_provider_time(data["settlement_time"]) ||
        parse_provider_time(data["transaction_time"]) || paid_at || Time.current
    end

    update!(attributes) if attributes.any? { |attribute, value| public_send(attribute) != value }
    true
  rescue KeyError, ArgumentError
    raise MidtransGateway::ProviderError, "Data status Midtrans tidak lengkap atau tidak valid."
  end

  class TransactionNotCancellable < StandardError
    def initialize
      super("Transaksi yang sudah memiliki pembayaran belum dapat dibatalkan sebelum proses refund tersedia.")
    end
  end

  belongs_to :order, optional: true
  belongs_to :rental, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :confirmed_by, class_name: "User", optional: true

  before_validation :assign_reference, on: :create

  validates :amount, numericality: { greater_than: 0 }
  validates :currency, inclusion: { in: %w[IDR] }
  validates :method, inclusion: { in: METHODS }
  validates :status, inclusion: { in: STATUSES }
  validates :reference, presence: true, uniqueness: true
  validates :idempotency_key, presence: true, length: { maximum: 100 }, uniqueness: true
  validate :has_exactly_one_transaction
  validate :cash_payment_fields
  validate :successful_payment_has_timestamp

  def self.record_cash!(order: nil, rental: nil, amount:, cash_received:, idempotency_key:, actor:)
    transaction_record = order || rental
    unless transaction_record && (order.nil? ^ rental.nil?)
      raise InvalidPayment.new("invalid_transaction", "Pilih tepat satu order atau penyewaan.")
    end

    parsed_amount = parse_amount(amount, "Nominal pembayaran")
    parsed_received = parse_amount(cash_received, "Uang diterima")
    unless idempotency_key.to_s.match?(/\A[a-zA-Z0-9._:-]{1,100}\z/)
      raise InvalidPayment.new("invalid_idempotency_key", "Header Idempotency-Key wajib diisi dengan format yang valid.")
    end

    transaction_record.with_lock do
      existing = find_by(idempotency_key: idempotency_key)
      if existing
        unless existing.order_id == order&.id && existing.rental_id == rental&.id &&
            existing.amount == parsed_amount && existing.cash_received == parsed_received && existing.method == "cash"
          raise InvalidPayment.new("idempotency_conflict", "Kunci idempotensi sudah digunakan untuk pembayaran yang berbeda.", :conflict)
        end
        next [ existing, false ]
      end

      if transaction_record.status.in?(%w[cancelled rejected])
        raise InvalidPayment.new("transaction_not_payable", "Transaksi yang dibatalkan tidak dapat menerima pembayaran.", :conflict)
      end
      if rental && !rental.status.in?(%w[confirmed active])
        raise InvalidPayment.new("rental_not_approved", "Pembayaran penyewaan hanya dapat dicatat setelah disetujui Admin/Kasir.", :conflict)
      end
      if transaction_record.payments.where(method: "gateway", provider: "midtrans", status: "pending").exists?
        raise InvalidPayment.new("gateway_payment_pending", "Pembayaran online sedang menunggu konfirmasi.", :conflict)
      end
      if transaction_record.payments.where(method: "qris", status: "pending").exists?
        raise InvalidPayment.new("qris_payment_pending", "Pembayaran QRIS sedang menunggu verifikasi kasir.", :conflict)
      end
      unless parsed_received >= parsed_amount
        raise InvalidPayment.new("insufficient_cash", "Uang diterima tidak boleh kurang dari nominal pembayaran.")
      end

      paid_amount = transaction_record.payments.where(status: "succeeded").sum(:amount)
      balance_due = transaction_record.total_amount - paid_amount
      if parsed_amount > balance_due
        raise InvalidPayment.new("payment_exceeds_balance", "Nominal pembayaran melebihi sisa tagihan.", :conflict)
      end

      payment = new(
        order: order,
        rental: rental,
        created_by: actor,
        confirmed_by: actor,
        amount: parsed_amount,
        cash_received: parsed_received,
        change_amount: parsed_received - parsed_amount,
        currency: "IDR",
        method: "cash",
        status: "succeeded",
        paid_at: Time.current,
        idempotency_key: idempotency_key
      )
      payment.save!
      [ payment, true ]
    end
  rescue ActiveRecord::RecordNotUnique
    existing = find_by(idempotency_key: idempotency_key)
    raise unless existing

    unless existing.order_id == order&.id && existing.rental_id == rental&.id &&
        existing.amount == parsed_amount && existing.cash_received == parsed_received && existing.method == "cash"
      raise InvalidPayment.new("idempotency_conflict", "Kunci idempotensi sudah digunakan untuk pembayaran yang berbeda.", :conflict)
    end
    [ existing, false ]
  end

  def self.record_qris!(order: nil, rental: nil, amount:, idempotency_key:, actor:)
    transaction_record = order || rental
    unless transaction_record && (order.nil? ^ rental.nil?)
      raise InvalidPayment.new("invalid_transaction", "Pilih tepat satu order atau penyewaan.")
    end
    unless idempotency_key.to_s.match?(/\A[a-zA-Z0-9._:-]{1,100}\z/)
      raise InvalidPayment.new("invalid_idempotency_key", "Header Idempotency-Key wajib diisi dengan format yang valid.")
    end

    parsed_amount = parse_amount(amount, "Nominal QRIS")
    transaction_record.with_lock do
      existing = find_by(idempotency_key: idempotency_key)
      if existing
        unless existing.order_id == order&.id && existing.rental_id == rental&.id &&
            existing.method == "qris" && existing.amount == parsed_amount
          raise InvalidPayment.new("idempotency_conflict", "Kunci idempotensi sudah digunakan untuk pembayaran yang berbeda.", :conflict)
        end
        next [ existing, false ]
      end

      if rental && !rental.status.in?(%w[confirmed active])
        raise InvalidPayment.new("rental_not_approved", "Pembayaran penyewaan hanya dapat dicatat setelah disetujui Admin/Kasir.", :conflict)
      end
      if transaction_record.status.in?(%w[cancelled rejected])
        raise InvalidPayment.new("transaction_not_payable", "Transaksi yang dibatalkan tidak dapat menerima pembayaran.", :conflict)
      end
      if transaction_record.payments.where(status: "pending").where(method: %w[gateway qris]).exists?
        raise InvalidPayment.new("payment_pending", "Pembayaran lain sedang menunggu konfirmasi.", :conflict)
      end

      paid_amount = transaction_record.payments.where(status: "succeeded").sum(:amount)
      balance_due = transaction_record.total_amount - paid_amount
      unless parsed_amount == balance_due && balance_due.positive?
        raise InvalidPayment.new("invalid_qris_amount", "Nominal QRIS harus sama dengan sisa tagihan transaksi.", :conflict)
      end

      payment = create!(
        order: order,
        rental: rental,
        created_by: actor,
        amount: parsed_amount,
        currency: "IDR",
        method: "qris",
        status: "pending",
        idempotency_key: idempotency_key
      )
      [ payment, true ]
    end
  rescue ActiveRecord::RecordNotUnique
    existing = find_by(idempotency_key: idempotency_key)
    raise unless existing
    unless existing.order_id == order&.id && existing.rental_id == rental&.id &&
        existing.method == "qris" && existing.amount == parsed_amount
      raise InvalidPayment.new("idempotency_conflict", "Kunci idempotensi sudah digunakan untuk pembayaran yang berbeda.", :conflict)
    end

    [ existing, false ]
  end

  def self.confirm_qris!(order: nil, rental: nil, payment_id:, actor:)
    transaction_record = order || rental
    unless transaction_record && (order.nil? ^ rental.nil?)
      raise InvalidPayment.new("invalid_transaction", "Pilih tepat satu order atau penyewaan.")
    end

    transaction_record.with_lock do
      payment = transaction_record.payments.lock.find(payment_id)
      raise InvalidPayment.new("invalid_method", "Hanya pembayaran QRIS statis yang dapat dikonfirmasi manual.") unless payment.method == "qris"
      return payment if payment.status == "succeeded"
      unless payment.status == "pending" && !transaction_record.status.in?(%w[cancelled rejected])
        raise InvalidPayment.new("payment_not_pending", "Pembayaran QRIS ini tidak lagi menunggu konfirmasi.", :conflict)
      end

      payment.update!(status: "succeeded", paid_at: Time.current, confirmed_by: actor)
      payment
    end
  end

  def self.summary_for(total_amount, payments)
    amount_paid = payments.select { |payment| payment.status == "succeeded" }.sum(&:amount)
    balance_due = [ total_amount - amount_paid, 0 ].max
    status = if amount_paid.zero?
      "unpaid"
    elsif balance_due.zero?
      "paid"
    else
      "partially_paid"
    end
    { payment_status: status, amount_paid: amount_paid, balance_due: balance_due }
  end

  def self.parse_amount(value, label)
    unless value.to_s.match?(/\A\d+(?:\.\d{1,2})?\z/)
      raise InvalidPayment.new("invalid_amount", "#{label} harus berupa nominal positif dengan maksimal dua angka desimal.")
    end

    amount = BigDecimal(value.to_s)
    raise InvalidPayment.new("invalid_amount", "#{label} harus lebih besar dari nol.") unless amount.positive?
    if amount > MAX_AMOUNT
      raise InvalidPayment.new("invalid_amount", "#{label} melebihi batas maksimum pembayaran.")
    end

    amount
  rescue ArgumentError
    raise InvalidPayment.new("invalid_amount", "#{label} tidak valid.")
  end

  private

  def has_exactly_one_transaction
    return if order_id.present? ^ rental_id.present?

    errors.add(:base, "Pembayaran harus terkait ke tepat satu order atau penyewaan.")
  end

  def cash_payment_fields
    return unless method == "cash"

    errors.add(:cash_received, "wajib diisi untuk pembayaran tunai.") if cash_received.nil?
    errors.add(:change_amount, "wajib diisi untuk pembayaran tunai.") if change_amount.nil?
    return if cash_received.nil? || amount.nil? || change_amount.nil?

    errors.add(:cash_received, "tidak boleh kurang dari nominal pembayaran.") if cash_received < amount
    errors.add(:change_amount, "tidak sesuai dengan uang diterima dan nominal pembayaran.") unless change_amount == cash_received - amount
  end

  def successful_payment_has_timestamp
    return unless status == "succeeded" && paid_at.blank?

    errors.add(:paid_at, "wajib diisi untuk pembayaran yang berhasil.")
  end

  def parse_provider_time(value)
    Time.zone.parse(value) if value.present?
  end

  def assign_reference
    self.reference ||= "PAY-#{Time.current.strftime('%y%m%d')}-#{SecureRandom.hex(5).upcase}"
  end
end
