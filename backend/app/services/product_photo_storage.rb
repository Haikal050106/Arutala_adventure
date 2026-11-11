class ProductPhotoStorage
  FOLDER = "arutala-adventure/produk"
  MAX_FILE_SIZE = 10.megabytes
  MAX_PHOTOS = 10
  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze

  class ValidationError < StandardError; end
  class StorageError < StandardError; end
  class ConfigurationError < StandardError; end

  def self.upload!(file)
    validate_file!(file)
    configure!

    result = Cloudinary::Uploader.upload(
      file.tempfile.path,
      folder: FOLDER,
      resource_type: "image",
      allowed_formats: %w[jpg jpeg png webp],
      unique_filename: true,
      overwrite: false
    )
    secure_url = result["secure_url"]
    public_id = result["public_id"]
    raise StorageError, "Cloudinary tidak mengembalikan identitas foto yang valid." if secure_url.blank? || public_id.blank?

    { secure_url: secure_url, public_id: public_id }
  rescue CloudinaryException, Faraday::Error => error
    raise StorageError, "Cloudinary menolak atau gagal menerima unggahan foto: #{error.message}"
  end

  def self.destroy!(public_id)
    configure!
    result = Cloudinary::Uploader.destroy(public_id, invalidate: true, resource_type: "image")
    return if %w[ok not found].include?(result["result"])

    raise StorageError, "Foto tidak dapat dihapus dari Cloudinary."
  rescue CloudinaryException, Faraday::Error => error
    raise StorageError, "Cloudinary gagal menghapus foto: #{error.message}"
  end

  def self.validate_file!(file)
    raise ValidationError, "File foto wajib dipilih." unless file.respond_to?(:tempfile) && file.tempfile
    raise ValidationError, "Ukuran foto maksimal 10 MB." if file.size > MAX_FILE_SIZE

    detected_type = Marcel::MimeType.for(file.tempfile)
    unless ALLOWED_CONTENT_TYPES.include?(detected_type)
      raise ValidationError, "Format foto harus JPEG, PNG, atau WebP."
    end
  ensure
    file.tempfile.rewind if file.respond_to?(:tempfile) && file.tempfile
  end
  private_class_method :validate_file!

  def self.configure!
    settings = %w[CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET].to_h do |name|
      [ name, ENV[name] ]
    end
    if settings.values.any?(&:blank?)
      raise ConfigurationError, "Konfigurasi CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET wajib diisi di backend."
    end

    Cloudinary.config do |config|
      config.cloud_name = settings.fetch("CLOUDINARY_CLOUD_NAME")
      config.api_key = settings.fetch("CLOUDINARY_API_KEY")
      config.api_secret = settings.fetch("CLOUDINARY_API_SECRET")
      config.secure = true
    end
  end
  private_class_method :configure!
end
