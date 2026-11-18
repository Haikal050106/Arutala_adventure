module Api
  module V1
    class ProductsController < BaseController
      skip_before_action :authenticate_request!, only: %i[index show rental_availability]
      before_action :require_admin!, only: %i[create update destroy]
      before_action :set_product, only: %i[show update destroy rental_availability]

      def index
        products = Product.includes(:category, :product_photos, product_variants: :product_photos).order(:name)
        products = products.where(category_id: params[:category_id]) if params[:category_id].present?
        products = products.where(featured: params[:featured]) if %w[true false].include?(params[:featured])
        render json: products.map { |product| serialize_product(product) }
      end

      def show
        render json: serialize_product(@product)
      end

      def rental_availability
        start_date = Date.iso8601(params.require(:start_date))
        return_date = Date.iso8601(params.require(:return_date))
        if start_date < Date.current || return_date <= start_date
          return render_error("invalid_rental_dates", "Tanggal sewa harus dimulai hari ini atau setelahnya dan tanggal kembali harus setelah tanggal mulai.", :unprocessable_entity)
        end

        variant = rental_availability_variant
        if @product.product_variants.exists? && !variant
          return render_error("variant_required", "Pilih varian untuk memeriksa ketersediaan sewa.", :unprocessable_entity)
        end
        if variant && !variant.active?
          return render_error("variant_unavailable", "Varian ini tidak tersedia.", :not_found)
        end

        render json: {
          product_id: @product.id,
          start_date: start_date,
          return_date: return_date,
          available_quantity: Rental.available_quantity_for(
            product: @product,
            variant: variant,
            start_date: start_date,
            return_date: return_date
          )
        }
      rescue ActionController::ParameterMissing, Date::Error
        render_error("invalid_rental_dates", "Tanggal mulai dan tanggal kembali yang valid wajib disertakan.", :unprocessable_entity)
      end

      def create
        product = Product.new(product_params)
        if product.save
          render json: serialize_product(product), status: :created
        else
          render_validation_errors(product)
        end
      end

      def update
        if @product.update(product_params)
          render json: serialize_product(@product)
        else
          render_validation_errors(@product)
        end
      end

      def destroy
        unless @product.destroy
          return render_error("product_in_use", "Produk atau variannya masih digunakan dan tidak dapat dihapus.", :conflict,
            details: @product.errors.full_messages)
        end
        head :no_content
      end

      private

      def set_product
        @product = Product.includes(:category, :product_photos, product_variants: :product_photos).find_by!(slug: params[:id])
      end

      def product_params
        params.require(:product).permit(
          :category_id, :slug, :name, :description, :sale_price, :rent_price_per_day,
          :sale_stock, :rental_stock, :featured, :image_url, :image_alt
        )
      end

      def serialize_product(product)
        photos = product.product_photos.map { |photo| serialize_photo(photo) }
        primary_photo = photos.find { |photo| photo[:is_primary] } || photos.first
        has_variants = product.product_variants.any?
        variants = product.product_variants.map { |variant| serialize_variant(variant) }
        active_variants = variants.select { |variant| variant[:active] }
        sale_stock = has_variants ? active_variants.sum { |variant| variant[:sale_stock] } : product.sale_stock
        rental_stock = has_variants ? active_variants.sum { |variant| variant[:rental_stock] } : product.rental_stock
        product.as_json(only: %i[
          id slug category_id name description sale_price rent_price_per_day sale_stock
          rental_stock featured image_url image_alt created_at updated_at
        ]).merge(
          "sale_stock" => sale_stock,
          "rental_stock" => rental_stock,
          "image_url" => primary_photo&.fetch(:secure_url) || product.image_url,
          "image_alt" => primary_photo&.fetch(:alt_text) || product.image_alt,
          "photos" => photos,
          "variants" => variants
        ).merge(
          category: { id: product.category.id, name: product.category.name },
          available: product.available?,
          availability_status: product.available? ? "available" : "unavailable"
        )
      end

      def serialize_variant(variant)
        photos = variant.product_photos.map { |photo| serialize_photo(photo) }
        primary_photo = photos.find { |photo| photo[:is_primary] } || photos.first
        {
          id: variant.id,
          name: variant.name,
          design_name: variant.design_name,
          color: variant.color,
          size: variant.size,
          capacity: variant.capacity,
          options: variant.options,
          sale_price: variant.sale_price,
          rent_price_per_day: variant.rent_price_per_day,
          sale_stock: variant.sale_stock,
          rental_stock: variant.rental_stock,
          image_url: primary_photo&.fetch(:secure_url) || variant.image_url,
          image_alt: primary_photo&.fetch(:alt_text) || variant.image_alt || variant.display_label,
          photos: photos,
          active: variant.active?
        }
      end

      def rental_availability_variant
        return unless params[:variant_id].present?

        @product.product_variants.find(params[:variant_id])
      end

      def serialize_photo(photo)
        {
          id: photo.id,
          secure_url: photo.secure_url,
          alt_text: photo.alt_text,
          position: photo.position,
          is_primary: photo.is_primary
        }
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data produk tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
