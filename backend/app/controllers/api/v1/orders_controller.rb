module Api
  module V1
    class OrdersController < BaseController
      before_action :require_staff!
      before_action :set_order, only: %i[show update destroy]

      rescue_from Order::InsufficientStock do |error|
        render_error("insufficient_stock", error.message, :conflict, details: { product: error.product_name })
      end

      def index
        orders = Order.includes(:customer, :payments, order_items: :product).order(created_at: :desc)
        orders = orders.where(customer_id: params[:customer_id]) if params[:customer_id].present?
        orders = orders.where(status: params[:status]) if params[:status].present?
        render json: orders.map { |order| serialize_order(order) }
      end

      def show
        render json: serialize_order(@order)
      end

      def create
        customer = Customer.find(order_params[:customer_id])
        order = Order.create_purchase!(
          customer: customer,
          notes: order_params[:notes],
          items: order_params[:items]
        )
        render json: serialize_order(order), status: :created
      rescue ArgumentError => error
        render_error("invalid_order", error.message, :unprocessable_entity)
      rescue KeyError => error
        render_error("invalid_order", error.message, :unprocessable_entity)
      rescue ActiveRecord::RecordInvalid => error
        render_validation_errors(error.record)
      rescue ActionController::ParameterMissing
        render_error("invalid_order", "Data pesanan wajib disertakan.", :unprocessable_entity)
      end

      def update
        Order.transaction do
          @order.update!(notes: order_params[:notes]) if order_params.key?(:notes)
          @order.transition_to!(order_params[:status]) if order_params[:status].present?
        end
        render json: serialize_order(@order.reload)
      rescue ActiveRecord::RecordInvalid => error
        render_validation_errors(error.record)
      rescue Payment::TransactionNotCancellable => error
        render_error("payment_refund_required", error.message, :conflict)
      rescue ActionController::ParameterMissing
        render_error("invalid_order", "Data pesanan wajib disertakan.", :unprocessable_entity)
      end

      def destroy
        unless %w[pending_confirmation cancelled].include?(@order.status)
          return render_error("order_not_deletable", "Pesanan terkonfirmasi tidak dapat dihapus.", :conflict)
        end

        @order.destroy!
        head :no_content
      end

      private

      def set_order
        @order = Order.includes(:customer, :payments, order_items: :product).find(params[:id])
      end

      def order_params
        params.require(:order).permit(:customer_id, :status, :notes, items: %i[product_id quantity])
      end

      def serialize_order(order)
        serialized = order.as_json(
          only: %i[id order_number customer_id status notes total_amount stock_deducted created_at updated_at],
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

      def render_validation_errors(record)
        render_error("validation_failed", "Data pesanan tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
