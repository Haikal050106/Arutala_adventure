module Api
  module V1
    class ProductsController < BaseController
      skip_before_action :authenticate_request!, only: %i[index show rental_availability]
      before_action :require_admin!, only: %i[create update destroy]
      before_action :set_product, only: %i[show update destroy rental_availability]

      def index
        products = Product.includes(:category).order(:name)
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

        render json: {
          product_id: @product.id,
          start_date: start_date,
          return_date: return_date,
          available_quantity: Rental.available_quantity_for(
            product: @product,
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
        @product.destroy!
        head :no_content
      end

      private

      def set_product
        @product = Product.includes(:category).find_by!(slug: params[:id])
      end

      def product_params
        params.require(:product).permit(
          :category_id, :slug, :name, :description, :sale_price, :rent_price_per_day,
          :sale_stock, :rental_stock, :featured, :image_url, :image_alt
        )
      end

      def serialize_product(product)
        product.as_json(only: %i[
          id slug category_id name description sale_price rent_price_per_day sale_stock
          rental_stock featured image_url image_alt created_at updated_at
        ]).merge(
          category: { id: product.category.id, name: product.category.name },
          available: product.available?,
          availability_status: product.available? ? "available" : "unavailable"
        )
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data produk tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
