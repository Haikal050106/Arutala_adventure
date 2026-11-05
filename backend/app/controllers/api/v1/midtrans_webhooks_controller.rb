module Api
  module V1
    class MidtransWebhooksController < ActionController::API
      def create
        gateway = MidtransGateway.new
        notification = request.request_parameters.stringify_keys
        unless gateway.valid_signature?(notification)
          return render json: { error: { code: "invalid_signature", message: "Signature Midtrans tidak valid." } },
            status: :unauthorized
        end

        MidtransPaymentService.new(gateway: gateway).process_notification!(notification: notification)
        head :ok
      rescue MidtransGateway::ConfigurationError => error
        Rails.logger.error("Midtrans webhook unavailable: #{error.message}")
        head :service_unavailable
      rescue MidtransGateway::ProviderError => error
        Rails.logger.error("Midtrans webhook verification failed: #{error.message}")
        head :service_unavailable
      end
    end
  end
end
