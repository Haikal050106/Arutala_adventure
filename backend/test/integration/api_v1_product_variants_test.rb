require "test_helper"

class ApiV1ProductVariantsTest < ActionDispatch::IntegrationTest
  def setup
    super
    @category = Category.create!(name: "Outdoor Varian #{SecureRandom.hex(3)}", description: "Kategori pengujian varian.")
    @product = Product.create!(
      category: @category,
      name: "Sepatu Varian #{SecureRandom.hex(3)}",
      description: "Produk pengujian pilihan varian.",
      sale_price: 100_000,
      rent_price_per_day: 10_000,
      sale_stock: 0,
      rental_stock: 0
    )
    @customer = Customer.create!(name: "Pelanggan Varian", email: "varian-#{SecureRandom.hex(3)}@example.test")
  end

  test "admins manage model combinations and public catalog serializes their options and stock" do
    post "/api/v1/products/#{@product.slug}/variants", params: {
      variant: {
        name: "Trail Run",
        design_name: "Desain A",
        color: "Hitam",
        size: "40",
        options: { bentuk: "low-cut" },
        sale_price: 125_000,
        sale_stock: 2,
        rental_stock: 1
      }
    }, as: :json
    assert_response :created
    variant_id = response.parsed_body.fetch("id")

    get "/api/v1/products/#{@product.slug}"
    assert_response :success
    assert_equal 2, response.parsed_body.fetch("sale_stock")
    assert_equal 1, response.parsed_body.fetch("rental_stock")
    variant = response.parsed_body.fetch("variants").first
    assert_equal "Trail Run", variant.fetch("name")
    assert_equal "Desain A", variant.fetch("design_name")
    assert_equal "Hitam", variant.fetch("color")
    assert_equal "40", variant.fetch("size")
    assert_equal "low-cut", variant.dig("options", "bentuk")

    post "/api/v1/products/#{@product.slug}/variants", params: {
      variant: {
        name: "Trail Run",
        design_name: "Desain B",
        color: "Hitam",
        size: "40",
        sale_stock: 3
      }
    }, as: :json
    assert_response :created
    assert_equal 5, Product.find(@product.id).product_variants.sum(:sale_stock)

    patch "/api/v1/products/#{@product.slug}/variants/#{variant_id}", params: {
      variant: { sale_stock: 0 }
    }, as: :json
    assert_response :success
    assert_equal 3, Product.find(@product.id).product_variants.sum(:sale_stock)
  end

  test "purchase checkout prices and reserves the selected variant then deducts its stock on confirmation" do
    variant = @product.product_variants.create!(
      name: "High Cut", design_name: "Desain Hutan", color: "Cokelat", size: "41", sale_price: 150_000,
      sale_stock: 2, rental_stock: 1
    )
    user = User.create!(
      name: @customer.name,
      email: @customer.email,
      password: "VariantCustomerPassword!2026",
      password_confirmation: "VariantCustomerPassword!2026",
      role: "customer",
      customer: @customer
    )
    headers = { "Authorization" => "Bearer #{AuthSession.issue_for(user).last}" }

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, variant_id: variant.id, quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => "variant-purchase-key"), as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")
    assert_equal BigDecimal("300000"), BigDecimal(response.parsed_body.fetch("total_amount").to_s)
    assert_equal "High Cut", response.parsed_body.dig("order_items", 0, "variant_name")
    assert_equal "Desain Hutan", response.parsed_body.dig("order_items", 0, "variant_design_name")
    assert_equal 2, variant.reload.sale_stock

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, variant_id: variant.id, quantity: 1 } ] }
    }, headers: headers.merge("Idempotency-Key" => "another-purchase-key"), as: :json
    assert_response :conflict

    patch "/api/v1/orders/#{order_id}", params: { order: { status: "confirmed" } }, as: :json
    assert_response :success
    assert_equal 0, variant.reload.sale_stock
  end

  test "rental availability is tracked independently for each variant and date range" do
    first = @product.product_variants.create!(
      name: "Model", design_name: "Desain A", color: "Merah", size: "", rental_stock: 1, sale_stock: 0
    )
    second = @product.product_variants.create!(
      name: "Model", design_name: "Desain B", color: "Biru", size: "", rental_stock: 2, sale_stock: 0
    )
    start_date = Date.current + 10
    return_date = start_date + 2
    booking = Rental.create_customer_booking!(
      customer: @customer,
      village_name: "Desa Uji",
      notes: "",
      idempotency_key: "rental-variant-test",
      items: [ {
        product_id: @product.id,
        variant_id: first.id,
        quantity: 1,
        start_date: start_date.iso8601,
        return_date: return_date.iso8601
      } ]
    )
    item = booking.rental_items.first
    assert_equal first.id, item.product_variant_id
    assert_equal "Desain A", item.variant_design_name
    assert_equal "Merah", item.variant_color
    assert_equal 0, Rental.available_quantity_for(
      product: @product, variant: first, start_date: start_date, return_date: return_date
    )
    assert_equal 2, Rental.available_quantity_for(
      product: @product, variant: second, start_date: start_date, return_date: return_date
    )
  end

  test "hydropack capacities have independent combinations and are serialized" do
    first = @product.product_variants.create!(
      name: "Hydropack", design_name: "Alpine", color: "Oranye", capacity: "2 L",
      sale_stock: 3, rental_stock: 1
    )
    second = @product.product_variants.create!(
      name: "Hydropack", design_name: "Alpine", color: "Oranye", capacity: "3 L",
      sale_stock: 5, rental_stock: 2
    )
    assert_equal 8, @product.product_variants.sum(:sale_stock)
    assert_equal "2 L", first.capacity
    assert_equal "3 L", second.capacity
    assert_raises(ActiveRecord::RecordInvalid) do
      @product.product_variants.create!(
        name: "Hydropack", design_name: "Alpine", color: "Oranye", capacity: "2 L"
      )
    end

    get "/api/v1/products/#{@product.slug}"
    assert_response :success
    serialized = response.parsed_body.fetch("variants").find { |variant| variant.fetch("id") == first.id }
    assert_equal "2 L", serialized.fetch("capacity")
  end
end
