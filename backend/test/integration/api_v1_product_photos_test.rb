require "test_helper"

class ApiV1ProductPhotosTest < ActionDispatch::IntegrationTest
  def setup
    super
    suffix = SecureRandom.hex(4)
    @category = Category.create!(name: "Tenda Foto #{suffix}", description: "Kategori untuk foto.")
    @product = Product.create!(
      category: @category,
      name: "Tenda Foto Uji #{suffix}",
      description: "Produk untuk menguji foto Cloudinary.",
      sale_price: 100_000,
      rent_price_per_day: 10_000,
      sale_stock: 1,
      rental_stock: 2
    )
  end

  test "photo uploads persist metadata, expose secure URLs, and replace before deleting the old asset" do
    first_upload = { secure_url: "https://res.cloudinary.com/demo/image/upload/first.jpg", public_id: "arutala-adventure/produk/first" }
    second_upload = { secure_url: "https://res.cloudinary.com/demo/image/upload/second.jpg", public_id: "arutala-adventure/produk/second" }
    with_storage_stub(:upload!, first_upload) do
      post "/api/v1/products/#{@product.slug}/photos", params: { file: uploaded_photo }
    end
    assert_response :created
    first_photo = @product.product_photos.find_by!(public_id: first_upload.fetch(:public_id))
    assert_predicate first_photo, :is_primary?
    assert_equal first_upload.fetch(:secure_url), @product.reload.image_url

    with_storage_stub(:upload!, second_upload) do
      post "/api/v1/products/#{@product.slug}/photos", params: { file: uploaded_photo }
    end
    assert_response :created
    second_photo = @product.product_photos.find_by!(public_id: second_upload.fetch(:public_id))
    assert_not second_photo.is_primary?
    assert_equal [ 1, 2 ], @product.product_photos.order(:position).pluck(:position)

    replacement = {
      secure_url: "https://res.cloudinary.com/demo/image/upload/replacement.jpg",
      public_id: "arutala-adventure/produk/replacement"
    }
    test_context = self
    old_public_id = first_upload.fetch(:public_id)
    with_storage_stub(:upload!, ->(*) {
      test_context.assert_equal old_public_id, first_photo.reload.public_id
      replacement
    }) do
      with_storage_stub(:destroy!, ->(public_id) {
        test_context.assert_equal old_public_id, public_id
        test_context.assert_equal replacement.fetch(:public_id), first_photo.reload.public_id
      }) do
        patch "/api/v1/products/#{@product.slug}/photos/#{first_photo.id}", params: { file: uploaded_photo }
      end
    end
    assert_response :success
    assert_equal replacement.fetch(:public_id), first_photo.reload.public_id

    patch "/api/v1/products/#{@product.slug}/photos/#{second_photo.id}", params: { is_primary: true }, as: :json
    assert_response :success
    assert_predicate second_photo.reload, :is_primary?
    assert_equal second_photo.secure_url, @product.reload.image_url

    with_storage_stub(:destroy!, ->(public_id) { test_context.assert_equal second_upload.fetch(:public_id), public_id }) do
      delete "/api/v1/products/#{@product.slug}/photos/#{second_photo.id}"
    end
    assert_response :no_content
    assert_predicate first_photo.reload, :is_primary?
    assert_equal replacement.fetch(:secure_url), @product.reload.image_url

    with_storage_stub(:destroy!, ->(public_id) { test_context.assert_equal replacement.fetch(:public_id), public_id }) do
      delete "/api/v1/products/#{@product.slug}/photos/#{first_photo.id}"
    end
    assert_response :no_content
    assert_not ProductPhoto.exists?(first_photo.id)
    assert_nil @product.reload.image_url
  end

  test "a failed replacement keeps the old photo record and asset reference" do
    photo = @product.product_photos.create!(
      secure_url: "https://res.cloudinary.com/demo/image/upload/original.jpg",
      public_id: "arutala-adventure/produk/original",
      alt_text: @product.name,
      position: 1,
      is_primary: true
    )
    @product.update_columns(image_url: photo.secure_url, image_alt: photo.alt_text)
    with_storage_stub(:upload!, ->(*) { raise ProductPhotoStorage::StorageError, "provider unavailable" }) do
      patch "/api/v1/products/#{@product.slug}/photos/#{photo.id}", params: { file: uploaded_photo }
    end

    assert_response :bad_gateway
    assert_equal "arutala-adventure/produk/original", photo.reload.public_id
    assert_equal photo.secure_url, @product.reload.image_url
  end

  test "photo management requires an admin session" do
    post "/api/v1/products/#{@product.slug}/photos",
      params: { file: uploaded_photo },
      headers: { "Authorization" => "Bearer invalid" }
    assert_response :unauthorized

    cashier = User.create!(
      name: "Kasir Foto",
      email: "cashier-photos@example.test",
      password: "CashierPhotoPassword!2026",
      password_confirmation: "CashierPhotoPassword!2026",
      role: "cashier"
    )
    _, cashier_token = AuthSession.issue_for(cashier)
    post "/api/v1/products/#{@product.slug}/photos",
      params: { file: uploaded_photo },
      headers: { "Authorization" => "Bearer #{cashier_token}" }
    assert_response :forbidden
  end

  test "server rejects files that are not actual supported image content" do
    Tempfile.create([ "unsupported-photo", ".txt" ]) do |tempfile|
      tempfile.write("not an image")
      tempfile.rewind
      file = ActionDispatch::Http::UploadedFile.new(
        tempfile: tempfile,
        filename: "unsupported-photo.txt",
        type: "image/jpeg"
      )

      error = assert_raises(ProductPhotoStorage::ValidationError) do
        ProductPhotoStorage.upload!(file)
      end
      assert_match "JPEG, PNG, atau WebP", error.message
    end
  end

  test "product photo serialization includes only the stored secure URL and ordered primary metadata" do
    photo = @product.product_photos.create!(
      secure_url: "https://res.cloudinary.com/demo/image/upload/photo.jpg",
      public_id: "arutala-adventure/produk/photo",
      alt_text: @product.name,
      position: 1,
      is_primary: true
    )

    get "/api/v1/products/#{@product.slug}"

    assert_response :success
    assert_equal photo.secure_url, response.parsed_body.fetch("image_url")
    assert_equal photo.secure_url, response.parsed_body.fetch("photos").first.fetch("secure_url")
    assert_equal true, response.parsed_body.fetch("photos").first.fetch("is_primary")
    assert_nil response.parsed_body.fetch("photos").first["public_id"]
  end

  private

  def uploaded_photo
    Rack::Test::UploadedFile.new(StringIO.new("image bytes"), "image/jpeg", original_filename: "photo.jpg")
  end

  def with_storage_stub(method_name, replacement)
    original = ProductPhotoStorage.method(method_name)
    implementation = replacement.respond_to?(:call) ? replacement : ->(*) { replacement }
    ProductPhotoStorage.define_singleton_method(method_name, &implementation)
    yield
  ensure
    ProductPhotoStorage.define_singleton_method(method_name, original)
  end
end
