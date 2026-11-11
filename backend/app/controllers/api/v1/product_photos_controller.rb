module Api
  module V1
    class ProductPhotosController < BaseController
      before_action :require_admin!
      before_action :set_product
      before_action :set_photo, only: %i[update destroy]

      def create
        if @product.product_photos.count >= ProductPhotoStorage::MAX_PHOTOS
          return render_error("photo_limit_reached", "Maksimal #{ProductPhotoStorage::MAX_PHOTOS} foto untuk satu produk.", :unprocessable_entity)
        end

        storage_result = ProductPhotoStorage.upload!(params[:file])
        photo = nil

        ProductPhoto.transaction do
          @product.lock!
          make_primary = ActiveModel::Type::Boolean.new.cast(params[:is_primary]) || @product.product_photos.empty?
          @product.product_photos.where(is_primary: true).update_all(is_primary: false) if make_primary
          photo = @product.product_photos.create!(
            secure_url: storage_result.fetch(:secure_url),
            public_id: storage_result.fetch(:public_id),
            alt_text: @product.name,
            position: @product.product_photos.maximum(:position).to_i + 1,
            is_primary: make_primary
          )
          sync_product_image!
        end

        render json: serialize_photo(photo), status: :created
      rescue ProductPhotoStorage::ValidationError => error
        render_error("invalid_photo", error.message, :unprocessable_entity)
      rescue ProductPhotoStorage::ConfigurationError => error
        render_error("cloudinary_not_configured", error.message, :service_unavailable)
      rescue ProductPhotoStorage::StorageError => error
        Rails.logger.error("Cloudinary photo upload failed: #{error.message}")
        render_error("photo_upload_failed", "Foto tidak dapat diunggah. Silakan coba lagi.", :bad_gateway)
      rescue ActiveRecord::RecordInvalid => error
        cleanup_new_photo(storage_result)
        render_error("validation_failed", "Foto produk tidak dapat disimpan.", :unprocessable_entity,
          details: error.record.errors.full_messages)
      end

      def update
        storage_result = ProductPhotoStorage.upload!(params[:file]) if params[:file].present?
        old_public_id = @photo.public_id if storage_result

        ProductPhoto.transaction do
          @product.lock!
          attributes = {}
          attributes[:secure_url] = storage_result.fetch(:secure_url) if storage_result
          attributes[:public_id] = storage_result.fetch(:public_id) if storage_result
          make_primary = params.key?(:is_primary) && ActiveModel::Type::Boolean.new.cast(params[:is_primary])
          @product.product_photos.where(is_primary: true).where.not(id: @photo.id).update_all(is_primary: false) if make_primary
          attributes[:is_primary] = make_primary if params.key?(:is_primary)
          attributes[:position] = params[:position].to_i if params.key?(:position)
          @photo.update!(attributes)
          sync_product_image!
        end

        cleanup_warning = destroy_replaced_photo(old_public_id) if old_public_id
        response = serialize_photo(@photo)
        response[:cleanup_warning] = cleanup_warning if cleanup_warning
        render json: response
      rescue ProductPhotoStorage::ValidationError => error
        render_error("invalid_photo", error.message, :unprocessable_entity)
      rescue ProductPhotoStorage::ConfigurationError => error
        render_error("cloudinary_not_configured", error.message, :service_unavailable)
      rescue ProductPhotoStorage::StorageError => error
        Rails.logger.error("Cloudinary photo replacement failed: #{error.message}")
        render_error("photo_replacement_failed", "Foto baru tidak dapat disimpan; foto lama tetap dipertahankan.", :bad_gateway)
      rescue ActiveRecord::RecordInvalid => error
        cleanup_new_photo(storage_result)
        render_error("validation_failed", "Perubahan foto tidak dapat disimpan.", :unprocessable_entity,
          details: error.record.errors.full_messages)
      end

      def destroy
        ProductPhotoStorage.destroy!(@photo.public_id)
        ProductPhoto.transaction do
          was_primary = @photo.is_primary?
          @photo.destroy!
          if was_primary
            next_photo = @product.product_photos.first
            next_photo&.update!(is_primary: true)
          end
          sync_product_image!
        end
        head :no_content
      rescue ProductPhotoStorage::ConfigurationError => error
        render_error("cloudinary_not_configured", error.message, :service_unavailable)
      rescue ProductPhotoStorage::StorageError => error
        Rails.logger.error("Cloudinary photo deletion failed: #{error.message}")
        render_error("photo_deletion_failed", "Foto tidak dapat dihapus. Data foto tetap tersimpan.", :bad_gateway)
      end

      private

      def set_product
        @product = Product.find_by!(slug: params[:product_id])
      end

      def set_photo
        @photo = @product.product_photos.find(params[:id])
      end

      def sync_product_image!
        photo = @product.product_photos.find_by(is_primary: true)
        @product.update_columns(image_url: photo&.secure_url, image_alt: photo&.alt_text)
      end

      def cleanup_new_photo(storage_result)
        return unless storage_result

        ProductPhotoStorage.destroy!(storage_result.fetch(:public_id))
      rescue ProductPhotoStorage::ConfigurationError, ProductPhotoStorage::StorageError => error
        Rails.logger.error("Cloudinary newly uploaded photo cleanup failed: #{error.message}")
      end

      def destroy_replaced_photo(public_id)
        ProductPhotoStorage.destroy!(public_id)
        nil
      rescue ProductPhotoStorage::ConfigurationError, ProductPhotoStorage::StorageError => error
        Rails.logger.error("Cloudinary old photo cleanup failed for product #{@product.id}: #{error.message}")
        "Foto baru tersimpan, tetapi foto lama belum dapat dibersihkan dari Cloudinary."
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
    end
  end
end
