module Api
  module V1
    class ShoeInventoriesController < BaseController
      before_action :require_admin!
      before_action :set_product
      before_action :require_shoe_product!
      before_action :set_inventory, only: %i[update destroy]

      def create
        inventory = @product.shoe_inventories.new(inventory_params)
        if inventory.save
          render json: serialize_inventory(inventory), status: :created
        else
          render_validation_errors(inventory)
        end
      end

      def update
        if @inventory.update(inventory_params)
          render json: serialize_inventory(@inventory)
        else
          render_validation_errors(@inventory)
        end
      end

      def destroy
        if @inventory.destroy
          head :no_content
        else
          render_error("shoe_inventory_in_use", "Inventori sepatu yang sudah digunakan pada transaksi tidak dapat dihapus.", :conflict,
            details: @inventory.errors.full_messages)
        end
      end

      private

      def set_product
        @product = Product.find_by!(slug: params[:product_id])
      end

      def set_inventory
        @inventory = @product.shoe_inventories.find(params[:id])
      end

      def require_shoe_product!
        return if @product.shoe?

        render_error("shoe_inventory_not_supported", "Inventori fisik berdasarkan ukuran hanya berlaku untuk sepatu.", :unprocessable_entity)
      end

      def inventory_params
        params.require(:shoe_inventory).permit(
          :name, :design_name, :color, :size, :sale_stock,
          :rental_stock, :image_url, :image_alt, :active, options: {}
        )
      end

      def serialize_inventory(inventory)
        photo = inventory.primary_photo
        inventory.as_json(only: %i[
          id product_id name design_name color size capacity options sale_price rent_price_per_day sale_stock
          rental_stock image_url image_alt active
        ]).merge(
          "image_url" => photo&.secure_url || inventory.image_url,
          "image_alt" => photo&.alt_text || inventory.image_alt || inventory.display_label,
          "photos" => inventory.product_photos.map do |item|
            { id: item.id, secure_url: item.secure_url, alt_text: item.alt_text, position: item.position, is_primary: item.is_primary }
          end
        )
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data inventori sepatu tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
