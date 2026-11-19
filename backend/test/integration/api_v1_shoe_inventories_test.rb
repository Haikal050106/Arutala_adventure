require "test_helper"

class ApiV1ShoeInventoriesTest < ActionDispatch::IntegrationTest
  def setup
    super
    @category = Category.create!(name: "Outdoor Uji #{SecureRandom.hex(3)}", description: "Kategori pengujian inventori sepatu.")
    @product = Product.create!(
      category: @category,
      name: "Sepatu Inventori #{SecureRandom.hex(3)}",
      description: "Produk pengujian inventori sepatu.",
      sale_price: 100_000,
      rent_price_per_day: 10_000,
      sale_stock: 0,
      rental_stock: 0
    )
    @customer = Customer.create!(name: "Pelanggan Sepatu", email: "sepatu-#{SecureRandom.hex(3)}@example.test")
  end

  test "admins manage shoe inventory while the public catalog only exposes aggregated sizes" do
    post "/api/v1/products/#{@product.slug}/shoe_inventories", params: {
      shoe_inventory: {
        name: "Trail Run",
        design_name: "Desain A",
        color: "Hitam",
        size: "40",
        sale_stock: 2,
        rental_stock: 1
      }
    }, as: :json
    assert_response :created
    inventory_id = response.parsed_body.fetch("id")

    get "/api/v1/products/#{@product.slug}", headers: { "Authorization" => "" }
    assert_response :success
    assert_equal 2, response.parsed_body.dig("shoe_sizes").find { |item| item.fetch("size") == "40" }.fetch("sale_stock")
    assert_not response.parsed_body.key?("shoe_inventories")
    assert_not response.parsed_body.key?("variants")

    get "/api/v1/products/#{@product.slug}", headers: { "Authorization" => "Bearer #{@default_test_token}" }
    assert_response :success
    inventory = response.parsed_body.fetch("shoe_inventories").first
    assert_equal "Trail Run", inventory.fetch("name")
    assert_equal "Desain A", inventory.fetch("design_name")
    assert_equal "Hitam", inventory.fetch("color")
    assert_equal "40", inventory.fetch("size")

    post "/api/v1/products/#{@product.slug}/shoe_inventories", params: {
      shoe_inventory: {
        name: "Trail Run",
        design_name: "Desain B",
        color: "Hitam",
        size: "40",
        sale_stock: 3
      }
    }, as: :json
    assert_response :created
    assert_equal 5, Product.find(@product.id).shoe_inventories.sum(:sale_stock)

    patch "/api/v1/products/#{@product.slug}/shoe_inventories/#{inventory_id}", params: {
      shoe_inventory: { sale_stock: 0 }
    }, as: :json
    assert_response :success
    assert_equal 3, Product.find(@product.id).shoe_inventories.sum(:sale_stock)
  end

  test "purchase checkout accepts a shoe size and allocates its physical inventory on the server" do
    inventory = @product.shoe_inventories.create!(
      name: "High Cut", design_name: "Desain Hutan", color: "Cokelat", size: "41", sale_price: 150_000,
      sale_stock: 2, rental_stock: 1
    )
    user = User.create!(
      name: @customer.name,
      email: @customer.email,
      password: "ShoeCustomerPassword!2026",
      password_confirmation: "ShoeCustomerPassword!2026",
      role: "customer",
      customer: @customer
    )
    headers = { "Authorization" => "Bearer #{AuthSession.issue_for(user).last}" }

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, size: "41", quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => "shoe-inventory-purchase-key"), as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")
    assert_equal BigDecimal("200000"), BigDecimal(response.parsed_body.fetch("total_amount").to_s)
    assert_equal "41", response.parsed_body.dig("order_items", 0, "inventory_size")
    assert_equal 2, inventory.reload.sale_stock

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, size: "41", quantity: 1 } ] }
    }, headers: headers.merge("Idempotency-Key" => "another-purchase-key"), as: :json
    assert_response :conflict

    patch "/api/v1/orders/#{order_id}", params: { order: { status: "confirmed" } }, as: :json
    assert_response :success
    assert_equal 0, inventory.reload.sale_stock
  end

  test "rental availability is aggregated by shoe size and date range" do
    first = @product.shoe_inventories.create!(
      name: "Model", design_name: "Desain A", color: "Merah", size: "40", rental_stock: 1, sale_stock: 0
    )
    second = @product.shoe_inventories.create!(
      name: "Model", design_name: "Desain B", color: "Biru", size: "40", rental_stock: 2, sale_stock: 0
    )
    start_date = Date.current + 10
    return_date = start_date + 2
    booking = Rental.create_customer_booking!(
      customer: @customer,
      village_name: "Desa Uji",
      notes: "",
      idempotency_key: "rental-shoe-inventory-test",
      items: [ {
        product_id: @product.id,
        size: "40",
        quantity: 1,
        start_date: start_date.iso8601,
        return_date: return_date.iso8601
      } ]
    )
    item = booking.rental_items.first
    assert_nil item.shoe_inventory_id
    assert_equal "40", item.inventory_size
    assert_equal 2, Rental.available_quantity_for_size(
      product: @product, size: "40", start_date: start_date, return_date: return_date
    )
  end

  test "hydropack stock is managed directly on the product without inventory records" do
    hydropack = Product.create!(
      category: @category,
      name: "Hydropack",
      description: "Hydropack tanpa pilihan kapasitas.",
      sale_price: 100_000,
      rent_price_per_day: 10_000,
      sale_stock: 3,
      rental_stock: 1
    )
    get "/api/v1/products/#{hydropack.slug}", headers: { "Authorization" => "" }
    assert_response :success
    assert_equal 3, response.parsed_body.fetch("sale_stock")
    assert_equal 1, response.parsed_body.fetch("rental_stock")
    assert_not response.parsed_body.fetch("is_shoe")
    assert_not response.parsed_body.key?("shoe_inventories")
    post "/api/v1/products/#{hydropack.slug}/shoe_inventories", params: {
      shoe_inventory: { name: "Tidak Berlaku", design_name: "Tidak Berlaku", size: "40", sale_stock: 1 }
    }, as: :json
    assert_response :unprocessable_entity

    user = User.create!(
      name: @customer.name,
      email: @customer.email,
      password: "HydropackCustomerPassword!2026",
      password_confirmation: "HydropackCustomerPassword!2026",
      role: "customer",
      customer: @customer
    )
    headers = { "Authorization" => "Bearer #{AuthSession.issue_for(user).last}" }
    shoe_inventory = @product.shoe_inventories.create!(
      name: "Inventori Uji",
      design_name: "Desain Uji",
      size: "40",
      sale_stock: 1,
      rental_stock: 1
    )
    post "/api/v1/orders", params: {
      order: {
        customer_id: @customer.id,
        items: [ { product_id: hydropack.id, shoe_inventory_id: shoe_inventory.id, quantity: 1 } ]
      }
    }, as: :json
    assert_response :unprocessable_entity
    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [ {
          product_id: hydropack.id,
          shoe_inventory_id: shoe_inventory.id,
          quantity: 1,
          start_date: (Date.current + 2).iso8601,
          return_date: (Date.current + 4).iso8601
        } ]
      }
    }, as: :json
    assert_response :unprocessable_entity

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: hydropack.id, quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => "hydropack-direct-stock"), as: :json
    assert_response :created
    patch "/api/v1/orders/#{response.parsed_body.fetch('id')}", params: { order: { status: "confirmed" } }
    assert_response :success
    assert_equal 1, hydropack.reload.sale_stock
  end

  test "unused shoe inventories can be deleted while used inventories cannot" do
    unused = @product.shoe_inventories.create!(
      name: "Unused", design_name: "Desain Baru", size: "38", sale_stock: 1, rental_stock: 1
    )
    delete "/api/v1/products/#{@product.slug}/shoe_inventories/#{unused.id}"
    assert_response :no_content
    assert_not ShoeInventory.exists?(unused.id)

    used = @product.shoe_inventories.create!(
      name: "Used", design_name: "Desain Lama", size: "39", sale_stock: 1, rental_stock: 1
    )
    Order.create_purchase!(
      customer: @customer,
      notes: "",
      items: [ {
        product_id: @product.id,
        size: "39",
        quantity: 1
      } ]
    )

    delete "/api/v1/products/#{@product.slug}/shoe_inventories/#{used.id}"
    assert_response :conflict
    assert_equal "shoe_inventory_in_use", response.parsed_body.dig("error", "code")
    assert ShoeInventory.exists?(used.id)
  end

  test "inactive shoe inventory stays visible to staff but is unavailable to customers" do
    inventory = @product.shoe_inventories.create!(
      name: "Inactive", design_name: "Desain Lama", size: "40", sale_stock: 2, rental_stock: 2
    )
    patch "/api/v1/products/#{@product.slug}/shoe_inventories/#{inventory.id}", params: {
      shoe_inventory: { active: false }
    }
    assert_response :success

    get "/api/v1/products/#{@product.slug}", headers: { "Authorization" => "Bearer #{@default_test_token}" }
    assert_response :success
    assert_includes response.parsed_body.fetch("shoe_inventories").map { |item| item.fetch("id") }, inventory.id

    get "/api/v1/products/#{@product.slug}", headers: { "Authorization" => "" }
    assert_response :success
    assert_not response.parsed_body.key?("shoe_inventories")

    user = User.create!(
      name: @customer.name,
      email: @customer.email,
      password: "InactiveShoeInventoryPassword!2026",
      password_confirmation: "InactiveShoeInventoryPassword!2026",
      role: "customer",
      customer: @customer
    )
    headers = { "Authorization" => "Bearer #{AuthSession.issue_for(user).last}" }

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, size: "40", quantity: 1 } ] }
    }, headers: headers.merge("Idempotency-Key" => "inactive-purchase"), as: :json
    assert_response :unprocessable_entity

    post "/api/v1/customer/rentals", params: {
      rental: {
        village_name: "Desa Uji",
        items: [ {
          product_id: @product.id,
          size: "40",
          quantity: 1,
          start_date: (Date.current + 2).iso8601,
          return_date: (Date.current + 4).iso8601
        } ]
      }
    }, headers: headers.merge("Idempotency-Key" => "inactive-rental"), as: :json
    assert_response :conflict

    patch "/api/v1/products/#{@product.slug}/shoe_inventories/#{inventory.id}", params: {
      shoe_inventory: { active: true }
    }
    assert_response :success
    assert response.parsed_body.fetch("active")
  end
end
