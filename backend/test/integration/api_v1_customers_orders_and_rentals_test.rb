require "test_helper"

class ApiV1CustomersOrdersAndRentalsTest < ActionDispatch::IntegrationTest
  def setup
    super
    @category = Category.create!(name: "Perlengkapan Uji", description: "Kategori pengujian.")
    @product = Product.create!(
      category: @category,
      name: "Carrier Pengujian",
      description: "Produk untuk pengujian transaksi.",
      sale_price: 125_000,
      rent_price_per_day: 10_000,
      sale_stock: 3,
      rental_stock: 2
    )
    @customer = Customer.create!(
      name: "Nadia Uji",
      email: "nadia-#{SecureRandom.hex(4)}@example.test",
      phone: "081234567890"
    )
  end

  test "customer CRUD persists normalized contact data and protects transaction history" do
    post "/api/v1/customers", params: {
      customer: {
        name: "Bima Uji",
        email: "  BIMA-#{SecureRandom.hex(4)}@Example.Test ",
        phone: "+6281234567891",
        village_name: "Desa Uji"
      }
    }, as: :json
    assert_response :created
    customer_id = response.parsed_body.fetch("id")

    get "/api/v1/customers/#{customer_id}"
    assert_response :success
    assert_equal "Desa Uji", response.parsed_body.fetch("village_name")

    get "/api/v1/customers"
    assert_response :success
    assert_includes response.parsed_body.map { |customer| customer.fetch("id") }, customer_id

    patch "/api/v1/customers/#{customer_id}", params: {
      customer: { name: "Bima Diperbarui" }
    }, as: :json
    assert_response :success
    assert_equal "Bima Diperbarui", response.parsed_body.fetch("name")

    put "/api/v1/customers/#{customer_id}", params: {
      customer: {
        name: "Bima Uji",
        email: response.parsed_body.fetch("email"),
        phone: "+6281234567891",
        village_name: "Kelurahan Uji"
      }
    }, as: :json
    assert_response :success
    assert_equal "Kelurahan Uji", response.parsed_body.fetch("village_name")

    delete "/api/v1/customers/#{customer_id}"
    assert_response :no_content
    assert_not Customer.exists?(customer_id)
  end

  test "offline customer without contact details can be used for POS orders and rentals" do
    post "/api/v1/customers", params: {
      customer: { name: "Pelanggan Walk-in" }
    }, as: :json
    assert_response :created
    offline_customer = response.parsed_body
    assert_nil offline_customer["email"]
    assert_nil offline_customer["phone"]
    assert_nil User.find_by(customer_id: offline_customer.fetch("id"))

    post "/api/v1/orders", params: {
      order: {
        customer_id: offline_customer.fetch("id"),
        items: [ { product_id: @product.id, quantity: 1 } ]
      }
    }, as: :json
    assert_response :created
    assert_equal offline_customer.fetch("id"), response.parsed_body.fetch("customer_id")

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: offline_customer.fetch("id"),
        village_name: "Desa Mendaki",
        items: [ {
          product_id: @product.id,
          quantity: 1,
          start_date: (Date.current + 10).iso8601,
          return_date: (Date.current + 12).iso8601
        } ]
      }
    }, as: :json
    assert_response :created
    assert_equal offline_customer.fetch("id"), response.parsed_body.fetch("customer_id")
  end

  test "POS customer creation reuses an existing customer with a matching normalized phone" do
    customer_count = Customer.count

    post "/api/v1/customers", params: {
      customer: { name: "Nama Alternatif", phone: "+62 812-3456-7890" }
    }, as: :json

    assert_response :success
    assert_equal @customer.id, response.parsed_body.fetch("id")
    assert_equal customer_count, Customer.count
    assert_equal "Nadia Uji", response.parsed_body.fetch("name")
  end

  test "online customer with an account remains usable for POS orders and rentals" do
    user = User.create!(
      name: @customer.name,
      email: @customer.email,
      password: "OnlineCustomerPassword!2026",
      password_confirmation: "OnlineCustomerPassword!2026",
      role: "customer",
      customer: @customer
    )
    assert_equal @customer.id, user.customer_id

    post "/api/v1/orders", params: {
      order: {
        customer_id: @customer.id,
        items: [ { product_id: @product.id, quantity: 1 } ]
      }
    }, as: :json
    assert_response :created
    assert_equal @customer.id, response.parsed_body.fetch("customer_id")

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [ {
          product_id: @product.id,
          quantity: 1,
          start_date: (Date.current + 10).iso8601,
          return_date: (Date.current + 12).iso8601
        } ]
      }
    }, as: :json
    assert_response :created
    assert_equal @customer.id, response.parsed_body.fetch("customer_id")
  end

  test "customer with an order cannot be deleted" do
    order = create_order(quantity: 1)

    delete "/api/v1/customers/#{@customer.id}"
    assert_response :conflict
    assert_equal "customer_has_transactions", response.parsed_body.dig("error", "code")
    assert Customer.exists?(@customer.id)
    assert Order.exists?(order.id)
  end

  test "order creation rolls back all records when a product is missing" do
    order_count = Order.count
    item_count = OrderItem.count

    post "/api/v1/orders", params: {
      order: {
        customer_id: @customer.id,
        items: [
          { product_id: @product.id, quantity: 1 },
          { product_id: 999_999, quantity: 1 }
        ]
      }
    }, as: :json

    assert_response :not_found
    assert_equal order_count, Order.count
    assert_equal item_count, OrderItem.count
    assert_equal 3, @product.reload.sale_stock
  end

  test "rental creation rolls back all records when a product is missing" do
    rental_count = Rental.count
    item_count = RentalItem.count

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [
          {
            product_id: @product.id,
            quantity: 1,
            start_date: "2026-12-01",
            return_date: "2026-12-03"
          },
          {
            product_id: 999_999,
            quantity: 1,
            start_date: "2026-12-01",
            return_date: "2026-12-03"
          }
        ]
      }
    }, as: :json

    assert_response :not_found
    assert_equal rental_count, Rental.count
    assert_equal item_count, RentalItem.count
    assert_equal 2, @product.reload.rental_stock
  end

  test "sale order stores server prices and deducts stock exactly once on confirmation" do
    post "/api/v1/orders", params: {
      order: {
        customer_id: @customer.id,
        notes: "Pesanan uji",
        items: [ { product_id: @product.id, quantity: 2, unit_price: 1 } ]
      }
    }, as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")
    assert_equal BigDecimal("250000"), BigDecimal(response.parsed_body.fetch("total_amount").to_s)
    assert_equal BigDecimal("125000"), BigDecimal(response.parsed_body.dig("order_items", 0, "unit_price").to_s)
    assert_equal 3, @product.reload.sale_stock
    assert OrderItem.exists?(order_id: order_id)

    get "/api/v1/orders/#{order_id}"
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("order_items").length

    get "/api/v1/orders/#{order_id}/items"
    assert_response :success
    assert_equal 1, response.parsed_body.length

    get "/api/v1/orders/#{order_id}/items/#{response.parsed_body.first.fetch('id')}"
    assert_response :success
    assert_equal order_id, response.parsed_body.fetch("order_id")

    get "/api/v1/orders"
    assert_response :success
    assert_includes response.parsed_body.map { |order| order.fetch("id") }, order_id

    patch "/api/v1/orders/#{order_id}", params: {
      order: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal "confirmed", response.parsed_body.fetch("status")
    assert_equal 1, @product.reload.sale_stock

    patch "/api/v1/orders/#{order_id}", params: {
      order: { status: "processing" }
    }, as: :json
    assert_response :success
    assert_equal 1, @product.reload.sale_stock
  end

  test "customer purchase uses server prices and is idempotent" do
    headers = customer_headers(@customer)
    key = "purchase-#{SecureRandom.hex(12)}"
    payload = {
      order: {
        customer_id: 999_999,
        total_amount: 1,
        notes: "Pesanan pelanggan",
        items: [ { product_id: @product.id, quantity: 2, unit_price: 1, subtotal: 2 } ]
      }
    }

    assert_difference("Order.count", 1) do
      post "/api/v1/customer/orders", params: payload, headers: headers.merge("Idempotency-Key" => key), as: :json
      assert_response :created
    end
    order_id = response.parsed_body.fetch("id")
    assert_equal @customer.id, response.parsed_body.fetch("customer_id")
    assert_equal BigDecimal("250000"), BigDecimal(response.parsed_body.fetch("total_amount").to_s)
    assert_equal BigDecimal("125000"), BigDecimal(response.parsed_body.dig("order_items", 0, "unit_price").to_s)

    post "/api/v1/customer/orders", params: payload, headers: headers.merge("Idempotency-Key" => key), as: :json
    assert_response :success
    assert_equal order_id, response.parsed_body.fetch("id")
    assert_equal 1, Order.where(customer: @customer, idempotency_key: key).count
    assert_equal 3, @product.reload.sale_stock
  end

  test "customer purchases reserve pending stock and reject insufficient quantities" do
    headers = customer_headers(@customer)
    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :created

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :conflict
    assert_equal "insufficient_stock", response.parsed_body.dig("error", "code")
    assert_equal 3, @product.reload.sale_stock
    assert_equal 1, Order.where(customer: @customer, status: "pending_confirmation").count
  end

  test "customer can only access their own orders and cannot use staff endpoints" do
    own_order = create_order(quantity: 1)
    other_customer = Customer.create!(
      name: "Pelanggan Lain",
      email: "other-#{SecureRandom.hex(4)}@example.test",
      phone: "081234567891"
    )
    other_order = Order.create!(customer: other_customer)
    headers = customer_headers(@customer)

    get "/api/v1/customer/orders", headers: headers
    assert_response :success
    assert_equal [ own_order.id ], response.parsed_body.map { |order| order.fetch("id") }

    get "/api/v1/customer/orders/#{other_order.id}", headers: headers
    assert_response :not_found

    get "/api/v1/orders", headers: headers
    assert_response :forbidden

    get "/api/v1/customer/orders", headers: { "Authorization" => "Bearer #{@default_test_token}" }
    assert_response :forbidden
  end

  test "customer cannot cancel another customer's order" do
    other_customer = Customer.create!(
      name: "Pelanggan Lain",
      email: "other-#{SecureRandom.hex(4)}@example.test",
      phone: "081234567891"
    )
    other_order = Order.create!(customer: other_customer)
    other_order.order_items.create!(
      product: @product,
      quantity: 1,
      unit_price: @product.sale_price,
      subtotal: @product.sale_price
    )

    post "/api/v1/customer/orders/#{other_order.id}/cancel", headers: customer_headers(@customer), as: :json

    assert_response :not_found
    assert_equal "pending_confirmation", other_order.reload.status
    assert_equal 3, @product.reload.sale_stock
  end

  test "customer cancellation requires authentication" do
    order = create_order(quantity: 1)

    post "/api/v1/customer/orders/#{order.id}/cancel", headers: { "Authorization" => "" }, as: :json

    assert_response :unauthorized
    assert_equal "pending_confirmation", order.reload.status
    assert_equal 3, @product.reload.sale_stock
  end

  test "customer cannot cancel orders outside cancellable statuses" do
    headers = customer_headers(@customer)
    %w[processing completed cancelled].each do |status|
      order = create_order(quantity: 1)
      order.update!(status: status)

      post "/api/v1/customer/orders/#{order.id}/cancel", headers: headers, as: :json

      assert_response :conflict
      assert_equal "order_not_cancellable", response.parsed_body.dig("error", "code")
      assert_match(/tidak dapat dibatalkan/, response.parsed_body.dig("error", "message"))
      assert_equal status, order.reload.status
      assert_equal 3, @product.reload.sale_stock
    end
  end

  test "customer can cancel a pending order once and release its stock reservation" do
    headers = customer_headers(@customer)
    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")

    post "/api/v1/customer/orders/#{order_id}/cancel", headers: headers, as: :json
    assert_response :success
    assert_equal "cancelled", response.parsed_body.fetch("status")
    assert_equal 3, @product.reload.sale_stock

    post "/api/v1/customer/orders/#{order_id}/cancel", headers: headers, as: :json
    assert_response :conflict
    assert_equal "cancelled", Order.find(order_id).status
    assert_equal 3, @product.reload.sale_stock

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 3 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :created
  end

  test "customer cancellation restores confirmed order stock only once" do
    headers = customer_headers(@customer)
    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 2 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")

    patch "/api/v1/orders/#{order_id}", params: { order: { status: "confirmed" } }, as: :json
    assert_response :success
    assert Order.find(order_id).stock_deducted?
    assert_equal 1, @product.reload.sale_stock

    post "/api/v1/customer/orders/#{order_id}/cancel", headers: headers, as: :json
    assert_response :success
    assert_equal "cancelled", response.parsed_body.fetch("status")
    assert_not Order.find(order_id).stock_deducted?
    assert_equal 3, @product.reload.sale_stock

    post "/api/v1/customer/orders/#{order_id}/cancel", headers: headers, as: :json
    assert_response :conflict
    assert_equal "cancelled", Order.find(order_id).status
    assert_equal 3, @product.reload.sale_stock
  end

  test "customer rental booking uses server pricing and is idempotent" do
    headers = customer_headers(@customer)
    key = "rental-#{SecureRandom.hex(12)}"
    payload = {
      rental: {
        customer_id: 999_999,
        village_name: "Desa Pendakian",
        items: [ {
          product_id: @product.id,
          quantity: 2,
          start_date: (Date.current + 10).iso8601,
          return_date: (Date.current + 13).iso8601,
          unit_price_per_day: 1
        } ]
      }
    }

    assert_difference("Rental.count", 1) do
      post "/api/v1/customer/rentals", params: payload,
        headers: headers.merge("Idempotency-Key" => key), as: :json
      assert_response :created
    end
    booking = response.parsed_body
    assert_equal @customer.id, booking.fetch("customer_id")
    assert_equal "pending_confirmation", booking.fetch("status")
    assert_equal BigDecimal("60000"), BigDecimal(booking.fetch("total_amount").to_s)
    assert_equal BigDecimal("10000"), BigDecimal(booking.dig("rental_items", 0, "unit_price_per_day").to_s)

    post "/api/v1/customer/rentals", params: payload,
      headers: headers.merge("Idempotency-Key" => key), as: :json
    assert_response :created
    assert_equal booking.fetch("id"), response.parsed_body.fetch("id")
    assert_equal 1, Rental.where(customer: @customer, idempotency_key: key).count
  end

  test "customer rental booking appears in the staff rental list with the same details" do
    headers = customer_headers(@customer)
    start_date = (Date.current + 20).iso8601
    return_date = (Date.current + 22).iso8601

    assert_difference("Rental.count", 1) do
      post "/api/v1/customer/rentals", params: {
        rental: {
          village_name: "Desa Pendakian",
          items: [ {
            product_id: @product.id,
            quantity: 1,
            start_date: start_date,
            return_date: return_date
          } ]
        }
      }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
      assert_response :created
    end
    customer_booking = response.parsed_body
    assert_equal "pending_confirmation", customer_booking.fetch("status")

    get "/api/v1/customer/rentals", headers: headers
    assert_response :success
    customer_listed_booking = response.parsed_body.find do |booking|
      booking.fetch("rental_number") == customer_booking.fetch("rental_number")
    end
    assert_not_nil customer_listed_booking

    get "/api/v1/rentals"
    assert_response :success
    staff_booking = response.parsed_body.find do |booking|
      booking.fetch("rental_number") == customer_booking.fetch("rental_number")
    end

    assert_not_nil staff_booking
    assert_equal customer_listed_booking.fetch("id"), staff_booking.fetch("id")
    assert_equal customer_listed_booking.fetch("customer"), staff_booking.fetch("customer")
    assert_equal customer_listed_booking.fetch("status"), staff_booking.fetch("status")
    assert_equal customer_listed_booking.fetch("total_amount"), staff_booking.fetch("total_amount")
    assert_equal customer_listed_booking.fetch("rental_items"), staff_booking.fetch("rental_items")
    assert_equal @customer.id, staff_booking.fetch("customer_id")
    assert_equal @product.name, staff_booking.dig("rental_items", 0, "product", "name")
    assert_equal start_date, staff_booking.dig("rental_items", 0, "start_date")
    assert_equal return_date, staff_booking.dig("rental_items", 0, "return_date")
  end

  test "customer rental booking rejects invalid and past dates" do
    headers = customer_headers(@customer)
    key = SecureRandom.hex(16)
    invalid_items = [
      {
        product_id: @product.id,
        quantity: 1,
        start_date: (Date.current + 3).iso8601,
        return_date: (Date.current + 3).iso8601
      },
      {
        product_id: @product.id,
        quantity: 1,
        start_date: (Date.current - 1).iso8601,
        return_date: (Date.current + 1).iso8601
      },
      {
        product_id: @product.id,
        quantity: 1.5,
        start_date: (Date.current + 1).iso8601,
        return_date: (Date.current + 2).iso8601
      }
    ]

    invalid_items.each_with_index do |item, index|
      post "/api/v1/customer/rentals", params: {
        rental: { village_name: "Desa Uji", items: [ item ] }
      }, headers: headers.merge("Idempotency-Key" => "#{key}-#{index}"), as: :json
      assert_response :unprocessable_entity
      assert_equal "invalid_rental", response.parsed_body.dig("error", "code")
    end
    assert_equal 0, Rental.count
  end

  test "customer rental booking enforces overlapping period capacity" do
    headers = customer_headers(@customer)
    start_date = (Date.current + 5).iso8601
    return_date = (Date.current + 8).iso8601
    post "/api/v1/customer/rentals", params: {
      rental: {
        village_name: "Desa Uji",
        items: [ { product_id: @product.id, quantity: 2, start_date: start_date, return_date: return_date } ]
      }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :created

    post "/api/v1/customer/rentals", params: {
      rental: {
        village_name: "Desa Uji",
        items: [ { product_id: @product.id, quantity: 1, start_date: start_date, return_date: return_date } ]
      }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :conflict
    assert_equal "insufficient_rental_stock", response.parsed_body.dig("error", "code")
    assert_equal 1, Rental.count
  end

  test "customers can only view their own rental bookings" do
    own_booking = Rental.create_booking!(
      customer: @customer,
      village_name: "Desa Uji",
      notes: nil,
      items: [ {
        product_id: @product.id,
        quantity: 1,
        start_date: Date.current + 2,
        return_date: Date.current + 4
      } ]
    )
    other_customer = Customer.create!(
      name: "Pelanggan Sewa Lain",
      email: "rental-other-#{SecureRandom.hex(4)}@example.test",
      phone: "081234567892"
    )
    other_booking = Rental.create_booking!(
      customer: other_customer,
      village_name: "Desa Lain",
      notes: nil,
      items: [ {
        product_id: @product.id,
        quantity: 1,
        start_date: Date.current + 5,
        return_date: Date.current + 7
      } ]
    )
    headers = customer_headers(@customer)

    get "/api/v1/customer/rentals", headers: headers
    assert_response :success
    assert_equal [ own_booking.id ], response.parsed_body.map { |booking| booking.fetch("id") }

    get "/api/v1/customer/rentals/#{own_booking.id}", headers: headers
    assert_response :success
    assert_equal own_booking.rental_number, response.parsed_body.fetch("rental_number")
    assert_equal 1, response.parsed_body.dig("rental_items", 0, "quantity")

    get "/api/v1/customer/rentals/#{other_booking.id}", headers: headers
    assert_response :not_found
  end

  test "customer rental endpoints require customer authentication" do
    post "/api/v1/customer/rentals", params: {
      rental: {
        village_name: "Desa Uji",
        items: [ {
          product_id: @product.id,
          quantity: 1,
          start_date: (Date.current + 1).iso8601,
          return_date: (Date.current + 2).iso8601
        } ]
      }
    }, headers: { "Authorization" => "" }, as: :json

    assert_response :unauthorized
    assert_equal 0, Rental.count
  end

  test "customer-cancelled order remains available in the staff order list" do
    headers = customer_headers(@customer)
    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 1 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")
    order_number = response.parsed_body.fetch("order_number")

    post "/api/v1/customer/orders/#{order_id}/cancel", headers: headers, as: :json
    assert_response :success
    assert_equal "cancelled", Order.find(order_id).status

    get "/api/v1/orders"
    assert_response :success
    listed_order = response.parsed_body.find { |order| order.fetch("order_number") == order_number }
    assert_not_nil listed_order
    assert_equal "cancelled", listed_order.fetch("status")

    get "/api/v1/orders", params: { status: "cancelled" }
    assert_response :success
    filtered_order = response.parsed_body.find { |order| order.fetch("order_number") == order_number }
    assert_not_nil filtered_order
    assert_equal "cancelled", filtered_order.fetch("status")
  end

  test "customer purchase requires an idempotency key and valid item quantities" do
    headers = customer_headers(@customer)
    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 1 } ] }
    }, headers: headers, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_idempotency_key", response.parsed_body.dig("error", "code")

    post "/api/v1/customer/orders", params: {
      order: { items: [ { product_id: @product.id, quantity: 1.5 } ] }
    }, headers: headers.merge("Idempotency-Key" => SecureRandom.hex(16)), as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_order", response.parsed_body.dig("error", "code")
  end

  test "sale confirmation cannot make stock negative and failure rolls back" do
    first_order = create_order(quantity: 2)
    second_order = create_order(quantity: 2)

    patch "/api/v1/orders/#{first_order.id}", params: {
      order: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal 1, @product.reload.sale_stock

    patch "/api/v1/orders/#{second_order.id}", params: {
      order: { status: "confirmed" }
    }, as: :json
    assert_response :conflict
    assert_equal "insufficient_stock", response.parsed_body.dig("error", "code")
    assert_equal "pending_confirmation", second_order.reload.status
    assert_equal 1, @product.reload.sale_stock
  end

  test "failed multi-product confirmation rolls back every stock update" do
    second_product = Product.create!(
      category: @category,
      name: "Kompor Pengujian",
      description: "Produk kedua untuk uji rollback.",
      sale_price: 50_000,
      rent_price_per_day: 5_000,
      sale_stock: 1,
      rental_stock: 1
    )
    post "/api/v1/orders", params: {
      order: {
        customer_id: @customer.id,
        items: [
          { product_id: @product.id, quantity: 1 },
          { product_id: second_product.id, quantity: 1 }
        ]
      }
    }, as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")
    second_product.update!(sale_stock: 0)

    patch "/api/v1/orders/#{order_id}", params: {
      order: { status: "confirmed" }
    }, as: :json
    assert_response :conflict
    assert_equal 3, @product.reload.sale_stock
    assert_equal "pending_confirmation", Order.find(order_id).status
  end

  test "pending orders can be deleted without changing stock" do
    order = create_order(quantity: 1)

    delete "/api/v1/orders/#{order.id}"
    assert_response :no_content
    assert_not Order.exists?(order.id)
    assert_equal 3, @product.reload.sale_stock
  end

  test "rental CRUD persists village and item dates and releases capacity when cancelled" do
    rental = create_rental(
      quantity: 2,
      start_date: "2026-12-01",
      return_date: "2026-12-04",
      village_name: "Desa Pendakian"
    )
    rental_id = rental.fetch("id")
    assert_equal "Desa Pendakian", rental.fetch("village_name")
    assert_equal BigDecimal("60000"), BigDecimal(rental.fetch("total_amount").to_s)
    assert_equal 3, rental.dig("rental_items", 0, "rental_days")
    assert_equal "not_returned", rental.fetch("return_status")
    assert RentalItem.exists?(rental_id: rental_id)

    get "/api/v1/rentals/#{rental_id}"
    assert_response :success
    assert_equal "Desa Pendakian", response.parsed_body.fetch("village_name")

    get "/api/v1/rentals/#{rental_id}/items"
    assert_response :success
    assert_equal "2026-12-01", response.parsed_body.first.fetch("start_date")

    get "/api/v1/rentals/#{rental_id}/items/#{response.parsed_body.first.fetch('id')}"
    assert_response :success
    assert_equal rental_id, response.parsed_body.fetch("rental_id")

    patch "/api/v1/rentals/#{rental_id}", params: {
      rental: { village_name: "Kelurahan Pendakian" }
    }, as: :json
    assert_response :success
    assert_equal "Kelurahan Pendakian", response.parsed_body.fetch("village_name")

    patch "/api/v1/rentals/#{rental_id}", params: {
      rental: { status: "cancelled" }
    }, as: :json
    assert_response :success
    assert_equal "not_applicable", response.parsed_body.fetch("return_status")

    next_rental = create_rental(
      quantity: 2,
      start_date: "2026-12-02",
      return_date: "2026-12-05"
    )
    delete "/api/v1/rentals/#{next_rental.fetch('id')}"
    assert_response :no_content
  end

  test "overlapping rentals cannot exceed stock but adjacent periods are allowed" do
    create_rental(quantity: 2, start_date: "2026-12-01", return_date: "2026-12-04")
    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [ {
          product_id: @product.id,
          quantity: 1,
          start_date: "2026-12-03",
          return_date: "2026-12-06"
        } ]
      }
    }, as: :json
    assert_response :conflict
    assert_equal "insufficient_rental_stock", response.parsed_body.dig("error", "code")

    adjacent = create_rental(
      quantity: 2,
      start_date: "2026-12-04",
      return_date: "2026-12-06"
    )
    assert_equal "pending_confirmation", adjacent.fetch("status")
  end

  test "public rental availability reserves active bookings without deducted stock" do
    @product.update!(rental_stock: 3)
    start_date = (Date.current + 10).iso8601
    return_date = (Date.current + 12).iso8601
    booking = create_rental(quantity: 2, start_date: start_date, return_date: return_date)
    Rental.find(booking.fetch("id")).update!(status: "active")

    get "/api/v1/products/#{@product.slug}/rental_availability", params: {
      start_date: start_date,
      return_date: return_date
    }

    assert_response :success
    assert_equal 1, response.parsed_body.fetch("available_quantity")
    assert_equal 3, @product.reload.rental_stock
  end

  test "missing village, invalid rental dates, quantities and customer data return validation errors" do
    post "/api/v1/customers", params: {
      customer: { name: "", email: "not-an-email", phone: "12" }
    }, as: :json
    assert_response :unprocessable_entity
    assert_equal "validation_failed", response.parsed_body.dig("error", "code")

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        items: [ {
          product_id: @product.id,
          quantity: 1,
          start_date: "2026-12-01",
          return_date: "2026-12-01"
        } ]
      }
    }, as: :json
    assert_response :unprocessable_entity

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        items: [ {
          product_id: @product.id,
          quantity: 1,
          start_date: "2026-12-01",
          return_date: "2026-12-03"
        } ]
      }
    }, as: :json
    assert_response :unprocessable_entity

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [ {
          product_id: @product.id,
          quantity: 0,
          start_date: "2026-12-01",
          return_date: "2026-12-03"
        } ]
      }
    }, as: :json
    assert_response :unprocessable_entity

    invalid_quantity = create_order_response(quantity: 0)
    assert_response :unprocessable_entity
    assert_equal "invalid_order", invalid_quantity.dig("error", "code")
  end

  test "rental returned status is exposed and releases reserved stock" do
    @product.update!(rental_stock: 10)
    rental = create_rental(
      quantity: 2,
      start_date: "2026-12-01",
      return_date: "2026-12-04"
    )
    assert_equal 10, @product.reload.rental_stock
    assert_not rental.fetch("stock_deducted")

    patch "/api/v1/rentals/#{rental.fetch('id')}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal 10, @product.reload.rental_stock
    assert_not response.parsed_body.fetch("stock_deducted")
    get "/api/v1/products/#{@product.slug}"
    assert_response :success
    assert_equal 10, response.parsed_body.fetch("rental_stock")

    patch "/api/v1/rentals/#{rental.fetch('id')}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :unprocessable_entity
    assert_equal 10, @product.reload.rental_stock

    post "/api/v1/rentals/#{rental.fetch('id')}/payments", params: {
      payment: { amount: "60000", cash_received: "60000" }
    }, headers: { "Idempotency-Key" => "handover-rental-#{SecureRandom.hex(6)}" }, as: :json
    assert_response :created

    patch "/api/v1/rentals/#{rental.fetch('id')}", params: {
      rental: { status: "active" }
    }, as: :json
    assert_response :success
    assert_equal 8, @product.reload.rental_stock

    patch "/api/v1/rentals/#{rental.fetch('id')}", params: {
      rental: {
        status: "returned",
        return_conditions: [ {
          rental_item_id: rental.dig("rental_items", 0, "id"),
          condition: "good"
        } ]
      }
    }, as: :json
    assert_response :success
    assert_equal "returned", response.parsed_body.fetch("return_status")
    assert_equal "good", response.parsed_body.dig("rental_items", 0, "return_condition")
    assert_not_nil response.parsed_body.fetch("actual_returned_at")
    assert_not response.parsed_body.fetch("stock_deducted")
    assert_equal 10, @product.reload.rental_stock
    get "/api/v1/products/#{@product.slug}"
    assert_response :success
    assert_equal 10, response.parsed_body.fetch("rental_stock")

    delete "/api/v1/rentals/#{rental.fetch('id')}"
    assert_response :conflict

    available = create_rental(
      quantity: 10,
      start_date: "2026-12-02",
      return_date: "2026-12-05"
    )
    assert_equal "pending_confirmation", available.fetch("status")

    start_date = "2026-12-20"
    return_date = "2026-12-22"
    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [
          { product_id: @product.id, quantity: 1, start_date: start_date, return_date: return_date },
          { product_id: @product.id, quantity: 1, start_date: start_date, return_date: return_date },
          { product_id: @product.id, quantity: 1, start_date: start_date, return_date: return_date }
        ]
      }
    }, as: :json
    assert_response :created
    mixed_condition_rental = response.parsed_body

    patch "/api/v1/rentals/#{mixed_condition_rental.fetch('id')}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal 10, @product.reload.rental_stock

    post "/api/v1/rentals/#{mixed_condition_rental.fetch('id')}/payments", params: {
      payment: { amount: "60000", cash_received: "60000" }
    }, headers: { "Idempotency-Key" => "mixed-condition-rental-#{SecureRandom.hex(6)}" }, as: :json
    assert_response :created

    patch "/api/v1/rentals/#{mixed_condition_rental.fetch('id')}", params: {
      rental: { status: "active" }
    }, as: :json
    assert_response :success
    assert_equal 7, @product.reload.rental_stock

    conditions = mixed_condition_rental.fetch("rental_items").zip(%w[good damaged lost]).map do |item, condition|
      { rental_item_id: item.fetch("id"), condition: condition }
    end
    patch "/api/v1/rentals/#{mixed_condition_rental.fetch('id')}", params: {
      rental: { status: "returned", return_conditions: conditions }
    }, as: :json
    assert_response :success
    assert_equal %w[good damaged lost], response.parsed_body.fetch("rental_items").map { |item| item.fetch("return_condition") }
    assert_equal 8, @product.reload.rental_stock
  end

  test "rental status transitions retain reservations until return and record history" do
    @product.update!(rental_stock: 10)
    start_date = (Date.current + 30).iso8601
    return_date = (Date.current + 33).iso8601
    rental = create_rental(quantity: 2, start_date: start_date, return_date: return_date)
    rental_id = rental.fetch("id")
    assert_equal "Test Admin", rental.dig("status_histories", 0, "changed_by")
    assert_equal 10, @product.reload.rental_stock
    assert_rental_booking_conflicts(start_date, return_date, quantity: 9)

    patch "/api/v1/rentals/#{rental_id}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal "confirmed", response.parsed_body.fetch("status")
    assert_equal 10, @product.reload.rental_stock
    assert_rental_booking_conflicts(start_date, return_date, quantity: 9)

    post "/api/v1/rentals/#{rental_id}/payments", params: {
      payment: { amount: "60000", cash_received: "60000" }
    }, headers: { "Idempotency-Key" => "transition-rental-#{SecureRandom.hex(6)}" }, as: :json
    assert_response :created

    patch "/api/v1/rentals/#{rental_id}", params: {
      rental: { status: "active" }
    }, as: :json
    assert_response :success
    assert_equal "active", response.parsed_body.fetch("status")
    assert_equal 8, @product.reload.rental_stock
    assert_rental_booking_conflicts(start_date, return_date, quantity: 9)

    item_id = rental.dig("rental_items", 0, "id")
    patch "/api/v1/rentals/#{rental_id}", params: {
      rental: { status: "returned" }
    }, as: :json
    assert_response :unprocessable_entity
    assert_equal "active", Rental.find(rental_id).status
    assert_equal 8, @product.reload.rental_stock
    assert_rental_booking_conflicts(start_date, return_date, quantity: 9)

    patch "/api/v1/rentals/#{rental_id}", params: {
      rental: {
        status: "returned",
        return_conditions: [ { rental_item_id: item_id, condition: "good" } ]
      }
    }, as: :json
    assert_response :success
    assert_equal "returned", response.parsed_body.fetch("status")
    assert_equal 10, @product.reload.rental_stock
    assert_equal %w[pending_confirmation confirmed active returned],
      response.parsed_body.fetch("status_histories").map { |history| history.fetch("to_status") }
    assert_equal "Test Admin", response.parsed_body.fetch("status_histories").last.fetch("changed_by")

    available = create_rental(quantity: 10, start_date: start_date, return_date: return_date)
    assert_equal "pending_confirmation", available.fetch("status")

    first = create_rental(quantity: 6, start_date: (Date.current + 50).iso8601, return_date: (Date.current + 52).iso8601)
    second = create_rental(quantity: 6, start_date: (Date.current + 60).iso8601, return_date: (Date.current + 62).iso8601)
    patch "/api/v1/rentals/#{first.fetch('id')}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal 10, @product.reload.rental_stock

    patch "/api/v1/rentals/#{second.fetch('id')}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal "confirmed", Rental.find(second.fetch("id")).status
    assert_equal 10, @product.reload.rental_stock

    second_product = Product.create!(
      category: @category,
      name: "Kompor Sewa Pengujian",
      description: "Produk kedua untuk uji stok sewa.",
      sale_price: 50_000,
      rent_price_per_day: 5_000,
      sale_stock: 1,
      rental_stock: 1
    )
    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Uji",
        items: [
          { product_id: @product.id, quantity: 1, start_date: "2027-01-20", return_date: "2027-01-22" },
          { product_id: second_product.id, quantity: 1, start_date: "2027-01-20", return_date: "2027-01-22" }
        ]
      }
    }, as: :json
    assert_response :created
    multi_product_rental_id = response.parsed_body.fetch("id")
    second_product.update!(rental_stock: 0)

    patch "/api/v1/rentals/#{multi_product_rental_id}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :conflict
    assert_equal 10, @product.reload.rental_stock
    assert_equal 0, second_product.reload.rental_stock
    assert_equal "pending_confirmation", Rental.find(multi_product_rental_id).status
    assert_not Rental.find(multi_product_rental_id).stock_deducted?
  end

  test "cancelling a pending rental releases reserved capacity without changing rental stock" do
    @product.update!(rental_stock: 10)
    start_date = (Date.current + 40).iso8601
    return_date = (Date.current + 43).iso8601
    rental = create_rental(quantity: 2, start_date: start_date, return_date: return_date)

    assert_equal 10, @product.reload.rental_stock
    patch "/api/v1/rentals/#{rental.fetch('id')}", params: {
      rental: { status: "cancelled" }
    }, as: :json
    assert_response :success
    assert_equal "cancelled", response.parsed_body.fetch("status")
    assert_equal 10, @product.reload.rental_stock

    confirmed_rental = create_rental(quantity: 2, start_date: start_date, return_date: return_date)
    patch "/api/v1/rentals/#{confirmed_rental.fetch('id')}", params: {
      rental: { status: "confirmed" }
    }, as: :json
    assert_response :success
    assert_equal 10, @product.reload.rental_stock

    patch "/api/v1/rentals/#{confirmed_rental.fetch('id')}", params: {
      rental: { status: "cancelled" }
    }, as: :json
    assert_response :success
    assert_equal 10, @product.reload.rental_stock

    patch "/api/v1/rentals/#{confirmed_rental.fetch('id')}", params: {
      rental: { status: "cancelled" }
    }, as: :json
    assert_response :unprocessable_entity
    assert_equal 10, @product.reload.rental_stock

    available = create_rental(quantity: 10, start_date: start_date, return_date: return_date)
    assert_equal "pending_confirmation", available.fetch("status")
  end

  private

  def create_order(quantity:)
    order = Order.create!(customer: @customer)
    order.order_items.create!(
      product: @product,
      quantity: quantity,
      unit_price: @product.sale_price,
      subtotal: @product.sale_price * quantity
    )
    order.update!(total_amount: @product.sale_price * quantity)
    order
  end

  def create_rental(quantity:, start_date:, return_date:, village_name: "Desa Uji")
    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: village_name,
        items: [ {
          product_id: @product.id,
          quantity: quantity,
          start_date: start_date,
          return_date: return_date
        } ]
      }
    }, as: :json
    assert_response :created
    response.parsed_body
  end

  def assert_rental_booking_conflicts(start_date, return_date, quantity: 1)
    post "/api/v1/rentals", params: {
      rental: {
        customer_id: @customer.id,
        village_name: "Desa Konflik",
        items: [ {
          product_id: @product.id,
          quantity: quantity,
          start_date: start_date,
          return_date: return_date
        } ]
      }
    }, as: :json
    assert_response :conflict
    assert_equal "insufficient_rental_stock", response.parsed_body.dig("error", "code")
  end

  def create_order_response(quantity:)
    post "/api/v1/orders", params: {
      order: {
        customer_id: @customer.id,
        items: [ { product_id: @product.id, quantity: quantity } ]
      }
    }, as: :json
    response.parsed_body
  end

  def customer_headers(customer)
    user = User.create!(
      name: customer.name,
      email: customer.email,
      password: "CustomerTestPassword!2026",
      password_confirmation: "CustomerTestPassword!2026",
      role: "customer",
      customer: customer
    )
    { "Authorization" => "Bearer #{AuthSession.issue_for(user).last}" }
  end
end
