module Api
  module V1
    class PaymentsController < BaseController
      before_action :require_staff!
      before_action :set_transaction

      def index
        render json: @transaction.payments.order(created_at: :asc).map { |payment| serialize_payment(payment) }
      end

      def create
        attributes = payment_params
        method = attributes[:method].presence || "cash"
        unless %w[cash qris].include?(method)
          return render_error("invalid_method", "Endpoint ini hanya menerima pembayaran tunai atau QRIS statis.", :unprocessable_entity)
        end

        idempotency_key = request.headers["Idempotency-Key"].to_s
        payment, created = if method == "qris"
          Payment.record_qris!(
            order: @order,
            rental: @rental,
            amount: attributes[:amount],
            idempotency_key: idempotency_key,
            actor: current_user
          )
        else
          Payment.record_cash!(
            order: @order,
            rental: @rental,
            amount: attributes[:amount],
            cash_received: attributes[:cash_received],
            idempotency_key: idempotency_key,
            actor: current_user
          )
        end
        render json: serialize_payment(payment), status: created ? :created : :ok
      rescue Payment::InvalidPayment => error
        render_error(error.code, error.message, error.status)
      rescue ActiveRecord::RecordInvalid => error
        render_error("validation_failed", "Data pembayaran tidak valid.", :unprocessable_entity,
          details: error.record.errors.full_messages)
      rescue ActionController::ParameterMissing
        render_error("invalid_payment", "Data pembayaran wajib disertakan.", :unprocessable_entity)
      end

      def confirm
        payment = Payment.confirm_qris!(order: @order, rental: @rental, payment_id: params[:id], actor: current_user)
        render json: serialize_payment(payment)
      rescue Payment::InvalidPayment => error
        render_error(error.code, error.message, error.status)
      rescue ActiveRecord::RecordInvalid => error
        render_error("validation_failed", "Konfirmasi pembayaran tidak valid.", :unprocessable_entity,
          details: error.record.errors.full_messages)
      end

      private

      def set_transaction
        if params[:order_id].present?
          @order = Order.find(params[:order_id])
          @transaction = @order
        elsif params[:rental_id].present?
          @rental = Rental.find(params[:rental_id])
          @transaction = @rental
        else
          raise ActiveRecord::RecordNotFound
        end
      end

      def payment_params
        params.require(:payment).permit(:amount, :cash_received, :method)
      end

      def serialize_payment(payment)
        payment.as_json(only: Payment::SERIALIZED_FIELDS)
      end
    end
  end
end
