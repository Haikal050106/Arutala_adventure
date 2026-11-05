module Api
  module V1
    class CategoriesController < BaseController
      skip_before_action :authenticate_request!, only: %i[index show]
      before_action :require_admin!, only: %i[create update destroy]
      before_action :set_category, only: %i[show update destroy]

      def index
        render json: Category.order(:name).map { |category| serialize_category(category) }
      end

      def show
        render json: serialize_category(@category)
      end

      def create
        category = Category.new(category_params)
        if category.save
          render json: serialize_category(category), status: :created
        else
          render_validation_errors(category)
        end
      end

      def update
        if @category.update(category_params)
          render json: serialize_category(@category)
        else
          render_validation_errors(@category)
        end
      end

      def destroy
        if @category.destroy
          head :no_content
        else
          render_error("category_in_use", "Kategori tidak dapat dihapus karena masih digunakan produk.", :conflict,
            details: @category.errors.full_messages)
        end
      end

      private

      def set_category
        @category = Category.find(params[:id])
      end

      def category_params
        params.require(:category).permit(:name, :description)
      end

      def serialize_category(category)
        category.as_json(only: %i[id name description created_at updated_at])
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data kategori tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
