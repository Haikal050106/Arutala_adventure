module Api
  module V1
    class CustomerOrdersController < BaseController
      before_action :require_customer!

      rescue_from Order::InsufficientStock do |error|
        render_error("insufficient_stock", error.message, :conflict, details: { product: error.product_name })
      end

      def index
        orders = current_user.customer.orders.includes(:customer, :payments, order_items: :product).order(created_at: :desc)
        render json: orders.map { |order| serialize_order(order) }
      end

      def show
        order = current_user.customer.orders.includes(:payments, order_items: :product).find(params[:id])
        render json: serialize_order(order)
      end

      def cancel
        order = current_user.customer.orders.includes(order_items: :product).find(params[:id])
        order.cancel_by_customer!
        render json: serialize_order(order.reload)
      rescue Order::CustomerCancellationNotAllowed => error
        render_error(
          "order_not_cancellable",
          cancellation_not_allowed_message(error.status),
          :conflict
        )
      rescue Payment::TransactionNotCancellable => error
        render_error("payment_refund_required", error.message, :conflict)
      end

      def create
        idempotency_key = request.headers["Idempotency-Key"].to_s
        unless idempotency_key.match?(/\A[a-zA-Z0-9._:-]{1,100}\z/)
          return render_error("invalid_idempotency_key", "Header Idempotency-Key wajib diisi dengan format yang valid.", :unprocessable_entity)
        end

        attributes = params.require(:order).permit(:notes, items: %i[product_id quantity])
        order, created = Order.create_customer_purchase!(
          customer: current_user.customer,
          notes: attributes[:notes],
          items: attributes[:items],
          idempotency_key: idempotency_key
        )
        render json: serialize_order(order), status: created ? :created : :ok
      rescue ArgumentError => error
        render_error("invalid_order", error.message, :unprocessable_entity)
      rescue KeyError => error
        render_error("invalid_order", error.message, :unprocessable_entity)
      rescue ActiveRecord::RecordInvalid => error
        render_error("validation_failed", "Data pesanan tidak valid.", :unprocessable_entity,
          details: error.record.errors.full_messages)
      rescue ActionController::ParameterMissing
        render_error("invalid_order", "Data pesanan wajib disertakan.", :unprocessable_entity)
      end

      private

      def cancellation_not_allowed_message(status)
        status_label = {
          "pending_confirmation" => "menunggu konfirmasi",
          "confirmed" => "dikonfirmasi",
          "processing" => "sedang diproses",
          "completed" => "selesai",
          "cancelled" => "sudah dibatalkan"
        }.fetch(status, status)
        "Pesanan berstatus #{status_label} tidak dapat dibatalkan. Pembatalan hanya tersedia saat menunggu konfirmasi atau setelah dikonfirmasi, sebelum pesanan diproses."
      end

      def serialize_order(order)
        serialized = order.as_json(
          only: %i[id order_number customer_id status notes total_amount created_at updated_at],
          include: {
            customer: { only: %i[id name email phone village_name] },
            order_items: {
              only: %i[id product_id quantity unit_price subtotal],
              include: { product: { only: %i[id slug name] } }
            },
            payments: { only: Payment::SERIALIZED_FIELDS }
          }
        )
        serialized.merge(Payment.summary_for(order.total_amount, order.payments))
      end
    end
  end
end
