module Api
  module V1
    class OrderItemsController < BaseController
      before_action :require_staff!
      before_action :set_order

      def index
        render json: @order.order_items.includes(:product).map { |item| serialize_item(item) }
      end

      def show
        item = @order.order_items.includes(:product).find(params[:id])
        render json: serialize_item(item)
      end

      private

      def set_order
        @order = Order.find(params[:order_id])
      end

      def serialize_item(item)
        item.as_json(
          only: %i[id order_id product_id quantity unit_price subtotal created_at updated_at],
          include: { product: { only: %i[id slug name] } }
        )
      end
    end
  end
end
