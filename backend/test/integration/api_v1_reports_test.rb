require "test_helper"

class ApiV1ReportsTest < ActionDispatch::IntegrationTest
  def setup
    super
    @category = Category.create!(name: "Kategori Dashboard", description: "Pengujian dashboard.")
    @product = Product.create!(
      category: @category,
      name: "Carrier Dashboard",
      description: "Perlengkapan untuk pengujian laporan.",
      sale_price: 125_000,
      rent_price_per_day: 10_000,
      sale_stock: 8,
      rental_stock: 4
    )
    @customer = Customer.create!(
      name: "Pelanggan Online Dashboard",
      email: "dashboard-#{SecureRandom.hex(5)}@example.test",
      phone: "081234567890"
    )
    User.create!(
      name: @customer.name,
      email: @customer.email,
      password: "OnlineDashboardPassword!2026",
      password_confirmation: "OnlineDashboardPassword!2026",
      role: "customer",
      customer: @customer
    )
    @offline_customer = Customer.create!(
      name: "Pelanggan Offline Dashboard",
      phone: "081234567891"
    )
  end

  test "dashboard aggregates successful payments once and separates order and rental revenue" do
    order = create_order(customer: @customer, quantity: 2)
    rental = create_rental(customer: @offline_customer, quantity: 1)
    rental.transition_to!("confirmed", actor: @default_test_user)

    record_payment(order: order, amount: 100_000, key: "dashboard-order-first")
    record_payment(order: order, amount: 150_000, key: "dashboard-order-second")
    record_payment(rental: rental, amount: 20_000, key: "dashboard-rental")
    Payment.create!(
      order: order,
      amount: 50_000,
      currency: "IDR",
      method: "gateway",
      status: "failed",
      reference: "PAY-FAILED-#{SecureRandom.hex(4)}",
      idempotency_key: "dashboard-failed-#{SecureRandom.hex(5)}"
    )

    get "/api/v1/dashboard", params: {
      start_date: Date.current.iso8601,
      end_date: Date.current.iso8601,
      period: "daily"
    }

    assert_response :success
    report = response.parsed_body
    assert_equal BigDecimal("270000"), BigDecimal(report.dig("revenue", "total"))
    assert_equal BigDecimal("250000"), BigDecimal(report.dig("revenue", "purchase"))
    assert_equal BigDecimal("20000"), BigDecimal(report.dig("revenue", "rental"))
    assert_equal 1, report.dig("transactions", "purchases")
    assert_equal 1, report.dig("transactions", "rentals")
    assert_equal 1, report.dig("customers", "online")
    assert_equal 1, report.dig("customers", "offline")
    assert_equal 2, report.dig("customers", "total")
    assert_equal BigDecimal("270000"), BigDecimal(report.fetch("revenue_chart").first.fetch("total"))
    assert_equal({ "product_id" => @product.id, "name" => @product.name, "quantity" => 2 },
      report.fetch("top_selling_products").first)
    assert_equal({ "product_id" => @product.id, "name" => @product.name, "quantity" => 1 },
      report.fetch("top_rented_products").first)
    assert_equal order.order_number, report.fetch("pending_orders").first.fetch("number")
    assert_equal rental.rental_number, report.fetch("pending_rentals").first.fetch("number")
  end

  test "dashboard clamps report dates to the operational reset and returns monthly buckets" do
    order = create_order(customer: @customer, quantity: 1)
    reset_at = ReportingWindow::RESET_AT
    order.update_column(:created_at, reset_at + 1.hour)
    payment = record_payment(order: order, amount: 125_000, key: "dashboard-monthly-old")
    payment.update_column(:paid_at, reset_at + 2.hours)

    get "/api/v1/dashboard", params: {
      start_date: (reset_at.to_date - 2.months).iso8601,
      end_date: (reset_at.to_date + 2.months).iso8601,
      period: "monthly"
    }

    assert_response :success
    report = response.parsed_body
    assert_equal BigDecimal("125000"), BigDecimal(report.dig("revenue", "purchase"))
    assert_equal reset_at.to_date.iso8601, report.fetch("filters").fetch("start_date")
    assert_equal reset_at.iso8601(3), report.fetch("reporting_start_at")
    assert_equal reset_at.to_date.beginning_of_month.strftime("%Y-%m"), report.fetch("revenue_chart").first.fetch("date")
    assert_equal 3, report.fetch("revenue_chart").length
  end

  test "reports exclude pre-reset transactions and payments while transaction history remains available" do
    reset_at = ReportingWindow::RESET_AT
    old_order = create_order(customer: @customer, quantity: 1)
    old_order.update_column(:created_at, reset_at - 1.second)
    record_payment(order: old_order, amount: 10_000, key: "pre-reset-order-payment")

    old_rental = create_rental(customer: @offline_customer, quantity: 1)
    old_rental.transition_to!("confirmed", actor: @default_test_user)
    old_rental.update_column(:created_at, reset_at - 1.second)
    record_payment(rental: old_rental, amount: 10_000, key: "pre-reset-rental-payment")

    get "/api/v1/dashboard", params: {
      start_date: reset_at.to_date.iso8601,
      end_date: Date.current.iso8601
    }

    assert_response :success
    assert_equal BigDecimal("0"), BigDecimal(response.parsed_body.dig("revenue", "total"))
    assert_equal 0, response.parsed_body.dig("transactions", "purchases")
    assert_equal 0, response.parsed_body.dig("transactions", "rentals")

    get "/api/v1/reports/transactions"

    assert_response :success
    assert_equal BigDecimal("0"), BigDecimal(response.parsed_body.dig("summary", "revenue", "total"))
    assert_equal 0, response.parsed_body.dig("summary", "transactions", "purchases")
    assert_equal 0, response.parsed_body.dig("summary", "transactions", "rentals")
    assert_empty response.parsed_body.fetch("transactions")

    get "/api/v1/orders"
    assert_response :success
    assert_includes response.parsed_body.map { |order| order.fetch("id") }, old_order.id

    get "/api/v1/rentals"
    assert_response :success
    assert_includes response.parsed_body.map { |rental| rental.fetch("id") }, old_rental.id

    new_order = create_order(customer: @customer, quantity: 1)
    record_payment(order: new_order, amount: 50_000, key: "post-reset-order-payment")
    new_rental = create_rental(customer: @offline_customer, quantity: 1)
    new_rental.transition_to!("confirmed", actor: @default_test_user)
    record_payment(rental: new_rental, amount: 20_000, key: "post-reset-rental-payment")

    get "/api/v1/dashboard", params: {
      start_date: reset_at.to_date.iso8601,
      end_date: Date.current.iso8601
    }

    assert_response :success
    assert_equal BigDecimal("70000"), BigDecimal(response.parsed_body.dig("revenue", "total"))

    get "/api/v1/reports/transactions"

    assert_response :success
    report = response.parsed_body
    assert_equal 1, report.dig("summary", "transactions", "purchases")
    assert_equal 1, report.dig("summary", "transactions", "rentals")
    assert_equal BigDecimal("70000"), BigDecimal(report.dig("summary", "revenue", "total"))
    assert_equal %w[purchase rental], report.fetch("transactions").map { |transaction| transaction.fetch("kind") }.sort
    assert_equal [ BigDecimal("20000"), BigDecimal("50000") ],
      report.fetch("transactions").map { |transaction| BigDecimal(transaction.fetch("successful_payment_amount")) }.sort
  end

  test "dashboard rejects invalid date range and period" do
    get "/api/v1/dashboard", params: { start_date: "bad-date" }
    assert_response :unprocessable_entity
    assert_equal "invalid_date_range", response.parsed_body.dig("error", "code")

    get "/api/v1/dashboard", params: { period: "yearly" }
    assert_response :unprocessable_entity
    assert_equal "invalid_period", response.parsed_body.dig("error", "code")

    get "/api/v1/dashboard", params: {
      start_date: Date.current.iso8601,
      end_date: (Date.current - 1.day).iso8601
    }
    assert_response :unprocessable_entity
    assert_equal "invalid_date_range", response.parsed_body.dig("error", "code")
  end

  test "dashboard is available to admin and cashier but not customer or anonymous users" do
    cashier = User.create!(
      name: "Kasir Dashboard",
      email: "cashier-dashboard-#{SecureRandom.hex(5)}@example.test",
      password: "CashierDashboardPassword!2026",
      password_confirmation: "CashierDashboardPassword!2026",
      role: "cashier"
    )
    cashier_token = AuthSession.issue_for(cashier).last
    get "/api/v1/dashboard", headers: { "Authorization" => "Bearer #{cashier_token}" }
    assert_response :success

    customer_user = User.find_by!(customer: @customer, role: "customer")
    customer_token = AuthSession.issue_for(customer_user).last
    get "/api/v1/dashboard", headers: { "Authorization" => "Bearer #{customer_token}" }
    assert_response :forbidden

    get "/api/v1/dashboard", headers: { "Authorization" => "Bearer invalid-dashboard-token" }
    assert_response :unauthorized
  end

  private

  def create_order(customer:, quantity:)
    Order.create_purchase!(
      customer: customer,
      notes: nil,
      items: [ { product_id: @product.id, quantity: quantity } ]
    )
  end

  def create_rental(customer:, quantity:)
    Rental.create_booking!(
      customer: customer,
      village_name: "Desa Dashboard",
      notes: nil,
      items: [ {
        product_id: @product.id,
        quantity: quantity,
        start_date: (Date.current + 10).iso8601,
        return_date: (Date.current + 12).iso8601
      } ]
    )
  end

  def record_payment(order: nil, rental: nil, amount:, key:)
    Payment.record_cash!(
      order: order,
      rental: rental,
      amount: amount,
      cash_received: amount,
      idempotency_key: key,
      actor: @default_test_user
    ).first
  end
end
