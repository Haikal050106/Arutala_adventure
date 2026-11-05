module Api
  module V1
    class RentalItemsController < BaseController
      before_action :require_staff!
      before_action :set_rental

      def index
        render json: @rental.rental_items.includes(:product).map { |item| serialize_item(item) }
      end

      def show
        item = @rental.rental_items.includes(:product).find(params[:id])
        render json: serialize_item(item)
      end

      private

      def set_rental
        @rental = Rental.find(params[:rental_id])
      end

      def serialize_item(item)
        item.as_json(
          only: %i[
            id rental_id product_id start_date return_date quantity unit_price_per_day rental_days subtotal created_at updated_at
          ],
          include: { product: { only: %i[id slug name] } }
        )
      end
    end
  end
end
