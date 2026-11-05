require "test_helper"

class ApiV1CategoriesAndProductsTest < ActionDispatch::IntegrationTest
  def setup
    super
    @category = Category.create!(name: "Tenda", description: "Perlengkapan tenda.")
  end

  test "category CRUD persists JSON data" do
    post "/api/v1/categories", params: {
      category: { name: "Carrier", description: "Tas untuk pendakian." }
    }, as: :json
    assert_response :created
    category_id = response.parsed_body.fetch("id")

    get "/api/v1/categories/#{category_id}"
    assert_response :success
    assert_equal "Carrier", response.parsed_body.fetch("name")

    patch "/api/v1/categories/#{category_id}", params: {
      category: { description: "Tas carrier untuk pendakian." }
    }, as: :json
    assert_response :success
    assert_equal "Tas carrier untuk pendakian.", response.parsed_body.fetch("description")

    put "/api/v1/categories/#{category_id}", params: {
      category: { name: "Carrier", description: "Tas carrier." }
    }, as: :json
    assert_response :success
    assert_equal "Tas carrier.", response.parsed_body.fetch("description")

    delete "/api/v1/categories/#{category_id}"
    assert_response :no_content
    assert_not Category.exists?(category_id)
  end

  test "product CRUD persists category, prices, stocks and availability" do
    post "/api/v1/products", params: {
      product: {
        category_id: @category.id,
        name: "Tenda Dua Orang",
        description: "Tenda ringan untuk dua pendaki.",
        sale_price: 1_850_000,
        rent_price_per_day: 85_000,
        sale_stock: 4,
        rental_stock: 8,
        image_url: "https://example.test/tent.jpg",
        image_alt: "Tenda di alam terbuka"
      }
    }, as: :json
    assert_response :created
    product_slug = response.parsed_body.fetch("slug")
    assert_equal "tenda-dua-orang", product_slug
    assert_equal "available", response.parsed_body.fetch("availability_status")
    assert_equal "Tenda", response.parsed_body.dig("category", "name")

    get "/api/v1/products"
    assert_response :success
    assert_equal 1, response.parsed_body.length

    patch "/api/v1/products/#{product_slug}", params: {
      product: { sale_stock: 0, rental_stock: 0 }
    }, as: :json
    assert_response :success
    assert_equal "unavailable", response.parsed_body.fetch("availability_status")
    assert_equal 0, Product.find_by!(slug: product_slug).sale_stock

    delete "/api/v1/products/#{product_slug}"
    assert_response :no_content
    assert_not Product.exists?(slug: product_slug)
  end

  test "invalid product and deletion of used category return useful errors" do
    post "/api/v1/products", params: { product: { name: "" } }, as: :json
    assert_response :unprocessable_entity
    assert_equal "validation_failed", response.parsed_body.dig("error", "code")

    product = Product.create!(
      category: @category,
      name: "Produk Uji",
      description: "Produk yang menggunakan kategori.",
      sale_price: 100,
      rent_price_per_day: 10,
      sale_stock: 1,
      rental_stock: 1
    )

    delete "/api/v1/categories/#{@category.id}"
    assert_response :conflict
    assert_equal "category_in_use", response.parsed_body.dig("error", "code")
    assert Product.exists?(product.id)
  end

  test "missing records return 404 JSON errors" do
    get "/api/v1/categories/999999"
    assert_response :not_found
    assert_equal "not_found", response.parsed_body.dig("error", "code")
  end

  test "Vite origin is allowed through CORS preflight" do
    options "/api/v1/categories", headers: {
      "Origin" => "http://localhost:5173",
      "Access-Control-Request-Method" => "POST",
      "Access-Control-Request-Headers" => "content-type"
    }

    assert_response :success
    assert_equal "http://localhost:5173", response.headers["Access-Control-Allow-Origin"]
    assert_includes response.headers["Access-Control-Allow-Methods"], "POST"
  end
end
