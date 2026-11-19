module Api
  module V1
    class ProductsController < BaseController
      skip_before_action :authenticate_request!, only: %i[index show rental_availability]
      before_action :optional_authenticate_request!, only: %i[index show]
      before_action :require_admin!, only: %i[create update destroy]
      before_action :set_product, only: %i[show update destroy rental_availability]

      def index
        products = Product.includes(:category, :product_photos, shoe_inventories: :product_photos).order(:name)
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

        if @product.shoe?
          size = params[:size].to_s
          unless Product::SHOE_SIZES.include?(size)
            return render_error("invalid_rental_size", "Pilih ukuran sepatu 38 sampai 43.", :unprocessable_entity)
          end

          available_quantity = Rental.available_quantity_for_size(
            product: @product,
            size: size,
            start_date: start_date,
            return_date: return_date
          )
        else
          return render_error("size_not_supported", "Produk ini tidak menggunakan ukuran sepatu.", :unprocessable_entity) if params[:size].present?

          available_quantity = Rental.available_quantity_for(
            product: @product,
            start_date: start_date,
            return_date: return_date
          )
        end

        render json: { product_id: @product.id, start_date: start_date, return_date: return_date, available_quantity: available_quantity }
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
          return render_error("product_in_use", "Produk atau inventori sepatunya masih digunakan dan tidak dapat dihapus.", :conflict,
            details: @product.errors.full_messages)
        end
        head :no_content
      end

      private

      def set_product
        @product = Product.includes(:category, :product_photos, shoe_inventories: :product_photos).find_by!(slug: params[:id])
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
        inventories = product.shoe? ? product.shoe_inventories : ShoeInventory.none
        active_inventories = inventories.where(active: true)
        shoe_sizes = Product::SHOE_SIZES.map do |size|
          {
            size: size,
            sale_stock: active_inventories.where(size: size).sum(:sale_stock),
            rental_stock: active_inventories.where(size: size).sum(:rental_stock)
          }
        end
        sale_stock = product.shoe? ? active_inventories.sum(:sale_stock) : product.sale_stock
        rental_stock = product.shoe? ? active_inventories.sum(:rental_stock) : product.rental_stock
        product.as_json(only: %i[
          id slug category_id name description sale_price rent_price_per_day sale_stock
          rental_stock featured image_url image_alt created_at updated_at
        ]).merge(
          "sale_stock" => sale_stock,
          "rental_stock" => rental_stock,
          "image_url" => primary_photo&.fetch(:secure_url) || product.image_url,
          "image_alt" => primary_photo&.fetch(:alt_text) || product.image_alt,
          "photos" => photos,
          "is_shoe" => product.shoe?,
          "shoe_sizes" => shoe_sizes
        ).merge(
          category: { id: product.category.id, name: product.category.name },
          available: product.available?,
          availability_status: product.available? ? "available" : "unavailable"
        ).tap do |serialized|
          if current_user&.role.in?(%w[admin cashier])
            serialized["shoe_inventories"] = product.shoe? ? inventories.map { |inventory| serialize_inventory(inventory) } : []
          end
        end
      end

      def serialize_inventory(inventory)
        photos = inventory.product_photos.map { |photo| serialize_photo(photo) }
        primary_photo = photos.find { |photo| photo[:is_primary] } || photos.first
        {
          id: inventory.id,
          name: inventory.name,
          design_name: inventory.design_name,
          color: inventory.color,
          size: inventory.size,
          capacity: inventory.capacity,
          options: inventory.options,
          sale_price: inventory.sale_price,
          rent_price_per_day: inventory.rent_price_per_day,
          sale_stock: inventory.sale_stock,
          rental_stock: inventory.rental_stock,
          active: inventory.active,
          image_url: primary_photo&.fetch(:secure_url) || inventory.image_url,
          image_alt: primary_photo&.fetch(:alt_text) || inventory.image_alt || inventory.display_label,
          photos: photos
        }
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
