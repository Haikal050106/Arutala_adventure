require "test_helper"

class ApiV1PaymentsTest < ActionDispatch::IntegrationTest
  def setup
    super
    @category = Category.create!(name: "Perlengkapan Pembayaran", description: "Kategori pengujian pembayaran.")
    @product = Product.create!(
      category: @category,
      name: "Produk Pembayaran",
      description: "Produk untuk pengujian ledger pembayaran.",
      sale_price: 125_000,
      rent_price_per_day: 10_000,
      sale_stock: 4,
      rental_stock: 3
    )
    @customer = Customer.create!(
      name: "Pelanggan Pembayaran",
      email: "payment-#{SecureRandom.hex(5)}@example.test",
      phone: "081234567890"
    )
  end

  test "cash payment records order payment without changing order status or stock and is idempotent" do
    order = create_order
    key = "cash-order-#{SecureRandom.hex(10)}"
    params = { payment: { amount: "125000", cash_received: "150000" } }

    assert_difference("Payment.count", 1) do
      post "/api/v1/orders/#{order.id}/payments", params: params,
        headers: { "Idempotency-Key" => key }, as: :json
      assert_response :created
    end
    payment = response.parsed_body
    assert_equal "cash", payment.fetch("method")
    assert_equal "succeeded", payment.fetch("status")
    assert_equal @default_test_user.id, payment.fetch("created_by_id")
    assert_equal @default_test_user.id, payment.fetch("confirmed_by_id")
    assert_equal BigDecimal("125000"), BigDecimal(payment.fetch("amount").to_s)
    assert_equal BigDecimal("150000"), BigDecimal(payment.fetch("cash_received").to_s)
    assert_equal BigDecimal("25000"), BigDecimal(payment.fetch("change_amount").to_s)
    assert payment.fetch("paid_at").present?
    assert_match(/\APAY-/, payment.fetch("reference"))
    assert_equal "pending_confirmation", order.reload.status
    assert_equal 4, @product.reload.sale_stock

    post "/api/v1/orders/#{order.id}/payments", params: params,
      headers: { "Idempotency-Key" => key }, as: :json
    assert_response :success
    assert_equal payment.fetch("id"), response.parsed_body.fetch("id")
    assert_equal 1, order.payments.count

    get "/api/v1/orders/#{order.id}"
    assert_response :success
    assert_equal "paid", response.parsed_body.fetch("payment_status")
    assert_equal BigDecimal("0"), BigDecimal(response.parsed_body.fetch("balance_due").to_s)
    assert_equal 1, response.parsed_body.fetch("payments").length
    assert_equal "pending_confirmation", response.parsed_body.fetch("status")
    assert_equal 4, @product.reload.sale_stock
  end

  test "cash payment records rental payment without changing rental status or stock" do
    rental = create_rental
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "confirmed" } }, as: :json
    assert_response :success

    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "10000", cash_received: "10000" }
    }, headers: { "Idempotency-Key" => "cash-rental-#{SecureRandom.hex(10)}" }, as: :json

    assert_response :created
    payment = Payment.find(response.parsed_body.fetch("id"))
    assert_equal rental.id, payment.rental_id
    assert_nil payment.order_id
    assert_equal "cash", payment.method
    assert_equal "succeeded", payment.status
    assert_equal @default_test_user.id, payment.created_by_id
    assert_equal @default_test_user.id, payment.confirmed_by_id
    assert payment.paid_at.present?
    rental.reload
    assert_equal "confirmed", rental.status
    assert_equal "partially_paid", Payment.summary_for(rental.total_amount, rental.payments).fetch(:payment_status)
    assert_equal 3, @product.reload.rental_stock

    get "/api/v1/rentals/#{rental.id}"
    assert_response :success
    assert_equal "partially_paid", response.parsed_body.fetch("payment_status")
    assert_equal "Menunggu Pembayaran", response.parsed_body.fetch("display_status")
    assert_equal BigDecimal("10000"), BigDecimal(response.parsed_body.fetch("amount_paid").to_s)
    assert_equal 1, response.parsed_body.fetch("payments").length
  end

  test "rental cash payment accepts exact amount and records no change" do
    rental = create_rental
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "confirmed" } }, as: :json
    assert_response :success

    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "20000", cash_received: "20000", method: "cash" }
    }, headers: { "Idempotency-Key" => "cash-rental-exact-#{SecureRandom.hex(6)}" }, as: :json

    assert_response :created
    payment = Payment.find(response.parsed_body.fetch("id"))
    assert_equal rental.id, payment.rental_id
    assert_equal BigDecimal("20000"), payment.amount
    assert_equal BigDecimal("20000"), payment.cash_received
    assert_equal BigDecimal("0"), payment.change_amount
    assert_equal "succeeded", payment.status
    assert payment.paid_at.present?
    assert_equal @default_test_user.id, payment.confirmed_by_id
    get "/api/v1/rentals/#{rental.id}"
    assert_response :success
    assert_equal "paid", response.parsed_body.fetch("payment_status")
    assert_equal "confirmed", rental.reload.status
  end

  test "rental cash payment calculates change from the amount received" do
    rental = create_rental
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "confirmed" } }, as: :json
    assert_response :success

    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "20000", cash_received: "25000", method: "cash" }
    }, headers: { "Idempotency-Key" => "cash-rental-change-#{SecureRandom.hex(6)}" }, as: :json

    assert_response :created
    payment = Payment.find(response.parsed_body.fetch("id"))
    assert_equal BigDecimal("20000"), payment.amount
    assert_equal BigDecimal("25000"), payment.cash_received
    assert_equal BigDecimal("5000"), payment.change_amount
    assert_equal @default_test_user.id, payment.confirmed_by_id
  end

  test "rental cash payment rejects an amount received below the payment amount" do
    rental = create_rental
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "confirmed" } }, as: :json
    assert_response :success

    assert_no_difference("Payment.count") do
      post "/api/v1/rentals/#{rental.id}/payments", params: {
        payment: { amount: "20000", cash_received: "19999", method: "cash" }
      }, headers: { "Idempotency-Key" => "cash-rental-short-#{SecureRandom.hex(6)}" }, as: :json
    end

    assert_response :unprocessable_entity
    assert_equal "insufficient_cash", response.parsed_body.dig("error", "code")
    assert_equal "unpaid", Payment.summary_for(rental.total_amount, rental.payments).fetch(:payment_status)
  end

  test "rental QRIS remains pending until cashier confirms and handover requires paid ledger" do
    rental = create_rental
    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "20000", method: "qris" }
    }, headers: { "Idempotency-Key" => "unapproved-rental-qris-#{SecureRandom.hex(6)}" }, as: :json
    assert_response :conflict
    assert_equal "rental_not_approved", response.parsed_body.dig("error", "code")
    assert_empty rental.payments

    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "confirmed" } }, as: :json
    assert_response :success
    assert_equal 3, @product.reload.rental_stock
    key = "rental-qris-#{SecureRandom.hex(8)}"

    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "20000", method: "qris" }
    }, headers: { "Idempotency-Key" => key }, as: :json
    assert_response :created
    payment_id = response.parsed_body.fetch("id")
    assert_equal "pending", response.parsed_body.fetch("status")
    assert_nil response.parsed_body.fetch("paid_at")
    assert_equal @default_test_user.id, Payment.find(payment_id).created_by_id
    assert_nil Payment.find(payment_id).confirmed_by_id
    get "/api/v1/rentals/#{rental.id}"
    assert_response :success
    assert_equal "unpaid", response.parsed_body.fetch("payment_status")

    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "active" } }, as: :json
    assert_response :unprocessable_entity
    assert_equal "confirmed", rental.reload.status
    assert_equal 3, @product.reload.rental_stock

    post "/api/v1/rentals/#{rental.id}/payments/#{payment_id}/confirm"
    assert_response :success
    payment = Payment.find(payment_id)
    assert_equal "succeeded", payment.status
    assert_equal @default_test_user.id, payment.confirmed_by_id
    assert payment.paid_at.present?
    assert_equal "paid", Payment.summary_for(rental.total_amount, rental.payments).fetch(:payment_status)

    get "/api/v1/rentals/#{rental.id}"
    assert_response :success
    assert_equal "paid", response.parsed_body.fetch("payment_status")
    assert_equal "Dibayar", response.parsed_body.fetch("display_status")

    post "/api/v1/rentals/#{rental.id}/payments/#{payment_id}/confirm"
    assert_response :success
    assert_equal 1, rental.reload.payments.where(status: "succeeded").count

    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "active" } }, as: :json
    assert_response :success
    assert_equal 2, @product.reload.rental_stock
    assert_equal "active", rental.reload.status
  end

  test "rejected rental cannot receive payment" do
    rental = create_rental
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "rejected" } }, as: :json
    assert_response :success

    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "20000", cash_received: "20000" }
    }, headers: { "Idempotency-Key" => "rejected-rental-#{SecureRandom.hex(6)}" }, as: :json
    assert_response :conflict
    assert_equal "transaction_not_payable", response.parsed_body.dig("error", "code")
    assert_empty rental.payments
    assert_equal 3, @product.reload.rental_stock
  end

  test "static QRIS stays pending until cashier confirms it and a paid order can complete" do
    order = create_order
    patch "/api/v1/orders/#{order.id}", params: { order: { status: "confirmed" } }, as: :json
    assert_response :success
    stock_after_confirmation = @product.reload.sale_stock
    key = "qris-order-#{SecureRandom.hex(10)}"

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", method: "qris" }
    }, headers: { "Idempotency-Key" => key }, as: :json

    assert_response :created
    payment = Payment.find(response.parsed_body.fetch("id"))
    assert_equal "qris", payment.method
    assert_equal "pending", payment.status
    assert_nil payment.paid_at
    assert_equal @default_test_user.id, payment.created_by_id
    assert_nil payment.confirmed_by_id
    assert_equal stock_after_confirmation, @product.reload.sale_stock

    get "/api/v1/orders/#{order.id}"
    assert_response :success
    assert_equal "unpaid", response.parsed_body.fetch("payment_status")
    assert_equal "pending", response.parsed_body.fetch("payments").first.fetch("status")

    patch "/api/v1/orders/#{order.id}", params: { order: { status: "processing" } }, as: :json
    assert_response :success
    patch "/api/v1/orders/#{order.id}", params: { order: { status: "completed" } }, as: :json
    assert_response :unprocessable_entity
    assert_equal "processing", order.reload.status

    post "/api/v1/orders/#{order.id}/payments/#{payment.id}/confirm"
    assert_response :success
    payment.reload
    assert_equal "succeeded", payment.status
    assert payment.paid_at.present?
    assert_equal @default_test_user.id, payment.confirmed_by_id
    assert_equal stock_after_confirmation, @product.reload.sale_stock

    get "/api/v1/orders/#{order.id}"
    assert_response :success
    assert_equal "paid", response.parsed_body.fetch("payment_status")
    assert_equal "qris", response.parsed_body.fetch("payments").first.fetch("method")

    patch "/api/v1/orders/#{order.id}", params: { order: { status: "completed" } }, as: :json
    assert_response :success
    assert_equal "completed", order.reload.status
  end

  test "pending static QRIS can be cancelled and restores confirmed stock" do
    order = create_order
    patch "/api/v1/orders/#{order.id}", params: { order: { status: "confirmed" } }, as: :json
    assert_response :success
    assert_equal 3, @product.reload.sale_stock

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", method: "qris" }
    }, headers: { "Idempotency-Key" => "qris-cancel-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :created
    payment = Payment.find(response.parsed_body.fetch("id"))

    patch "/api/v1/orders/#{order.id}", params: { order: { status: "cancelled" } }, as: :json
    assert_response :success
    assert_equal "cancelled", order.reload.status
    assert_equal "failed", payment.reload.status
    assert_equal 4, @product.reload.sale_stock

    post "/api/v1/orders/#{order.id}/payments/#{payment.id}/confirm"
    assert_response :conflict
    assert_equal "failed", payment.reload.status
  end

  test "pending static QRIS blocks another payment method and rejects invalid amount" do
    order = create_order
    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "124999", method: "qris" }
    }, headers: { "Idempotency-Key" => "qris-invalid-amount-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :conflict
    assert_equal "invalid_qris_amount", response.parsed_body.dig("error", "code")
    assert_empty order.payments

    key = "qris-pending-#{SecureRandom.hex(10)}"
    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", method: "qris" }
    }, headers: { "Idempotency-Key" => key }, as: :json
    assert_response :created

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "125000" }
    }, headers: { "Idempotency-Key" => "qris-cash-conflict-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :conflict
    assert_equal "qris_payment_pending", response.parsed_body.dig("error", "code")
    assert_equal 1, order.payments.count
  end

  test "rejects invalid, insufficient and over-balance cash payments" do
    order = create_order
    headers = { "Idempotency-Key" => "invalid-payment-#{SecureRandom.hex(10)}" }

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "125000", method: "gateway" }
    }, headers: { "Idempotency-Key" => "gateway-payment-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_method", response.parsed_body.dig("error", "code")
    assert_empty order.payments

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "0", cash_received: "1" }
    }, headers: headers, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_amount", response.parsed_body.dig("error", "code")

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "1000000000000" }
    }, headers: { "Idempotency-Key" => "excessive-cash-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_amount", response.parsed_body.dig("error", "code")

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "100000", cash_received: "99999" }
    }, headers: { "Idempotency-Key" => "short-cash-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :unprocessable_entity
    assert_equal "insufficient_cash", response.parsed_body.dig("error", "code")

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125001", cash_received: "125001" }
    }, headers: { "Idempotency-Key" => "overpay-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :conflict
    assert_equal "payment_exceeds_balance", response.parsed_body.dig("error", "code")
    assert_empty order.payments
    assert_equal "pending_confirmation", order.reload.status
  end

  test "rejects conflicting idempotency reuse and cancelled transactions" do
    order = create_order
    key = "reused-payment-#{SecureRandom.hex(10)}"
    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "50000", cash_received: "50000" }
    }, headers: { "Idempotency-Key" => key }, as: :json
    assert_response :created

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "75000", cash_received: "75000" }
    }, headers: { "Idempotency-Key" => key }, as: :json
    assert_response :conflict
    assert_equal "idempotency_conflict", response.parsed_body.dig("error", "code")
    assert_equal 1, order.payments.count

    cancelled_order = create_order
    cancelled_order.update!(status: "cancelled")
    post "/api/v1/orders/#{cancelled_order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "125000" }
    }, headers: { "Idempotency-Key" => "cancelled-payment-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :conflict
    assert_equal "transaction_not_payable", response.parsed_body.dig("error", "code")
  end

  test "paid transactions cannot be cancelled without a refund flow" do
    order = create_order
    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "125000" }
    }, headers: { "Idempotency-Key" => "paid-cancel-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :created

    post "/api/v1/customer/orders/#{order.id}/cancel", headers: payment_customer_headers(@customer), as: :json
    assert_response :conflict
    assert_equal "payment_refund_required", response.parsed_body.dig("error", "code")
    assert_equal "pending_confirmation", order.reload.status

    rental = create_rental
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "confirmed" } }, as: :json
    assert_response :success
    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "10000", cash_received: "10000" }
    }, headers: { "Idempotency-Key" => "paid-rental-cancel-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :created
    patch "/api/v1/rentals/#{rental.id}", params: { rental: { status: "cancelled" } }, as: :json
    assert_response :conflict
    assert_equal "confirmed", rental.reload.status
    assert_equal 3, @product.reload.rental_stock
  end

  test "customer can read only own payment history while customer cannot create cash payments" do
    order = create_order
    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "125000" }
    }, headers: { "Idempotency-Key" => "customer-history-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :created

    customer_token = payment_customer_headers(@customer)
    get "/api/v1/customer/orders/#{order.id}", headers: customer_token
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("payments").length
    assert_equal "paid", response.parsed_body.fetch("payment_status")

    rental = create_rental
    rental.transition_to!("confirmed", actor: @default_test_user)
    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "10000", cash_received: "10000" }
    }, headers: { "Idempotency-Key" => "customer-rental-history-#{SecureRandom.hex(10)}" }, as: :json
    assert_response :created
    get "/api/v1/customer/rentals/#{rental.id}", headers: customer_token
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("payments").length

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "1", cash_received: "1" }
    }, headers: customer_token.merge("Idempotency-Key" => "customer-create-#{SecureRandom.hex(10)}"), as: :json
    assert_response :forbidden

    other_customer = Customer.create!(
      name: "Pelanggan Lain",
      email: "other-payment-#{SecureRandom.hex(5)}@example.test",
      phone: "081234567891"
    )
    other_token = payment_customer_headers(other_customer)
    get "/api/v1/customer/orders/#{order.id}", headers: other_token
    assert_response :not_found
    get "/api/v1/customer/rentals/#{rental.id}", headers: other_token
    assert_response :not_found

    get "/api/v1/orders/#{order.id}/payments", headers: customer_token
    assert_response :forbidden
    get "/api/v1/rentals/#{rental.id}/payments", headers: customer_token
    assert_response :forbidden
  end

  test "admin can record and read order and rental payments" do
    admin = User.create!(
      name: "Admin Pembayaran",
      email: "admin-payment-#{SecureRandom.hex(5)}@example.test",
      password: "AdminTestPassword!2026",
      password_confirmation: "AdminTestPassword!2026",
      role: "admin"
    )
    admin_token = AuthSession.issue_for(admin).last
    admin_headers = { "Authorization" => [ "Bearer", admin_token ].join(" ") }
    order = create_order

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "125000" }
    }, headers: admin_headers.merge("Idempotency-Key" => "admin-order-payment-#{SecureRandom.hex(8)}"), as: :json
    assert_response :created
    assert_equal admin.id, response.parsed_body.fetch("created_by_id")

    get "/api/v1/orders/#{order.id}/payments", headers: admin_headers
    assert_response :success
    assert_equal 1, response.parsed_body.length

    rental = create_rental
    rental.transition_to!("confirmed", actor: admin)
    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "10000", cash_received: "10000" }
    }, headers: admin_headers.merge("Idempotency-Key" => "admin-rental-payment-#{SecureRandom.hex(8)}"), as: :json
    assert_response :created
    assert_equal admin.id, response.parsed_body.fetch("created_by_id")

    get "/api/v1/rentals/#{rental.id}/payments", headers: admin_headers
    assert_response :success
    assert_equal 1, response.parsed_body.length
  end

  test "cashier can record and read cash payments" do
    cashier = User.create!(
      name: "Kasir Pembayaran",
      email: "cashier-payment-#{SecureRandom.hex(5)}@example.test",
      password: "CashierTestPassword!2026",
      password_confirmation: "CashierTestPassword!2026",
      role: "cashier"
    )
    cashier_token = AuthSession.issue_for(cashier).last
    cashier_headers = { "Authorization" => [ "Bearer", cashier_token ].join(" ") }
    order = create_order
    order.transition_to!("confirmed")
    sale_stock_after_confirmation = @product.reload.sale_stock
    assert_equal 3, sale_stock_after_confirmation

    post "/api/v1/orders/#{order.id}/payments", params: {
      payment: { amount: "125000", cash_received: "130000" }
    }, headers: cashier_headers.merge("Idempotency-Key" => "cashier-payment-#{SecureRandom.hex(8)}"), as: :json
    assert_response :created
    assert_equal cashier.id, response.parsed_body.fetch("created_by_id")
    assert_equal "confirmed", order.reload.status
    assert_equal sale_stock_after_confirmation, @product.reload.sale_stock

    get "/api/v1/orders/#{order.id}/payments", headers: cashier_headers
    assert_response :success
    assert_equal 1, response.parsed_body.length

    rental = create_rental
    rental.transition_to!("confirmed", actor: cashier)
    rental_stock_after_confirmation = @product.reload.rental_stock
    assert_equal 3, rental_stock_after_confirmation
    rental_key = "cashier-rental-payment-#{SecureRandom.hex(8)}"
    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "10000", cash_received: "10000" }
    }, headers: cashier_headers.merge("Idempotency-Key" => rental_key), as: :json
    assert_response :created
    assert_equal cashier.id, response.parsed_body.fetch("created_by_id")
    payment_id = response.parsed_body.fetch("id")
    assert_equal rental.id, Payment.find(payment_id).rental_id
    assert_equal "confirmed", rental.reload.status
    assert_equal rental_stock_after_confirmation, @product.reload.rental_stock

    post "/api/v1/rentals/#{rental.id}/payments", params: {
      payment: { amount: "10000", cash_received: "10000" }
    }, headers: cashier_headers.merge("Idempotency-Key" => rental_key), as: :json
    assert_response :success
    assert_equal payment_id, response.parsed_body.fetch("id")

    get "/api/v1/rentals/#{rental.id}/payments", headers: cashier_headers
    assert_response :success
    assert_equal 1, response.parsed_body.length
    assert_equal 1, rental.payments.count
  end

  private

  def create_order
    Order.create_purchase!(
      customer: @customer,
      notes: nil,
      items: [ { product_id: @product.id, quantity: 1 } ]
    )
  end

  def create_rental
    Rental.create_booking!(
      customer: @customer,
      village_name: "Desa Pembayaran",
      notes: nil,
      items: [ {
        product_id: @product.id,
        quantity: 1,
        start_date: (Date.current + 10).iso8601,
        return_date: (Date.current + 12).iso8601
      } ],
      actor: @default_test_user
    )
  end

  def payment_customer_headers(customer)
    user = User.create!(
      name: customer.name,
      email: customer.email,
      password: "CustomerTestPassword!2026",
      password_confirmation: "CustomerTestPassword!2026",
      role: "customer",
      customer: customer
    )
    token = AuthSession.issue_for(user).last
    raise "Customer test token was not issued" unless AuthSession.authenticate(token)

    { "Authorization" => [ "Bearer", token ].join(" ") }
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
    { "Authorization" => "******" }
  end
end
