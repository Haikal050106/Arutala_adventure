module Api
  module V1
    class ProductVariantsController < BaseController
      before_action :require_admin!
      before_action :set_product
      before_action :set_variant, only: %i[update destroy]

      def create
        variant = @product.product_variants.new(variant_params)
        if variant.save
          render json: serialize_variant(variant), status: :created
        else
          render_validation_errors(variant)
        end
      end

      def update
        if @variant.update(variant_params)
          render json: serialize_variant(@variant)
        else
          render_validation_errors(@variant)
        end
      end

      def destroy
        if @variant.destroy
          head :no_content
        else
          render_error("variant_in_use", "Varian yang sudah digunakan pada transaksi tidak dapat dihapus.", :conflict,
            details: @variant.errors.full_messages)
        end
      end

      private

      def set_product
        @product = Product.find_by!(slug: params[:product_id])
      end

      def set_variant
        @variant = @product.product_variants.find(params[:id])
      end

      def variant_params
        params.require(:variant).permit(
          :name, :design_name, :color, :size, :capacity, :sale_price, :rent_price_per_day, :sale_stock,
          :rental_stock, :image_url, :image_alt, :active, options: {}
        )
      end

      def serialize_variant(variant)
        photo = variant.primary_photo
        variant.as_json(only: %i[
          id product_id name design_name color size capacity options sale_price rent_price_per_day sale_stock
          rental_stock image_url image_alt active
        ]).merge(
          "image_url" => photo&.secure_url || variant.image_url,
          "image_alt" => photo&.alt_text || variant.image_alt || variant.display_label,
          "photos" => variant.product_photos.map do |item|
            { id: item.id, secure_url: item.secure_url, alt_text: item.alt_text, position: item.position, is_primary: item.is_primary }
          end
        )
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data varian tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
