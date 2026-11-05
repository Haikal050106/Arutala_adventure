module Api
  module V1
    class CustomerPaymentsController < BaseController
      before_action :require_customer!

      def refresh
        payment = owned_gateway_payments.find(params[:payment_id])
        MidtransPaymentService.new.refresh!(payment: payment)
        render json: serialize_payment(payment.reload)
      rescue MidtransGateway::ConfigurationError => error
        render_error("gateway_not_configured", error.message, :service_unavailable)
      rescue MidtransGateway::ProviderError => error
        render_error("gateway_unavailable", error.message, :bad_gateway)
      rescue Payment::InvalidPayment => error
        render_error(error.code, error.message, error.status)
      end

      private

      def owned_gateway_payments
        Payment.where(
          method: "gateway",
          provider: "midtrans",
          order_id: current_user.customer.orders.select(:id)
        ).or(
          Payment.where(
            method: "gateway",
            provider: "midtrans",
            rental_id: current_user.customer.rentals.select(:id)
          )
        )
      end

      def serialize_payment(payment)
        payment.as_json(only: Payment::SERIALIZED_FIELDS)
      end
    end
  end
end
