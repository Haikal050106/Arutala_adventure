require "test_helper"

class ApiV1GatewayPaymentsTest < ActionDispatch::IntegrationTest
  class FakeGateway
    attr_reader :client_key

    def initialize
      @client_key = "SB-Mid-client-test"
      @statuses = {}
    end

    def create_snap(payment:, customer:)
      {
        token: "snap-token-#{payment.id}",
        redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/test"
      }
    end

    def status(reference)
      @statuses.fetch(reference)
    end

    def set_status(reference, attributes)
      @statuses[reference] = attributes.stringify_keys
    end

    def valid_signature?(notification)
      notification["signature_key"] == "test-signature"
    end
  end

  def setup
    super
    @category = Category.create!(name: "Gateway Payment", description: "Kategori pengujian.")
    @product = Product.create!(
      category: @category,
      name: "Produk Gateway",
      description: "Produk untuk pengujian Midtrans.",
      sale_price: 125_000,
      rent_price_per_day: 10_000,
      sale_stock: 4,
      rental_stock: 3
    )
    @customer = Customer.create!(
      name: "Pelanggan Gateway",
      email: "gateway-#{SecureRandom.hex(5)}@example.test",
      phone: "081234567890"
    )
    @customer_headers = customer_headers(@customer)
    @gateway = FakeGateway.new
  end

  test "customer Snap checkout endpoints are unavailable for new payments" do
    order = create_order
    rental = create_rental

    post "/api/v1/customer/orders/#{order.id}/payments", headers: @customer_headers, as: :json
    assert_response :not_found

    post "/api/v1/customer/rentals/#{rental.id}/payments", headers: @customer_headers, as: :json
    assert_response :not_found

    assert_empty order.payments
    assert_empty rental.payments
  end

  test "webhook verifies provider status, ignores duplicate and stale events, and does not change fulfillment" do
    order = create_order
    payment = initiate_order_payment(order)
    success_status = provider_status(payment, "settlement")
    @gateway.set_status(payment.reference, success_status)
    notification = signed_notification(payment)

    with_gateway do
      2.times { post "/api/v1/webhooks/midtrans", params: notification, as: :json }
    end

    assert_response :success
    payment.reload
    assert_equal "succeeded", payment.status
    assert_equal "settlement", payment.provider_transaction_status
    assert payment.paid_at.present?
    paid_at = payment.paid_at
    @gateway.set_status(payment.reference, provider_status(payment, "pending"))
    with_gateway { post "/api/v1/webhooks/midtrans", params: notification, as: :json }
    assert_response :success
    assert_equal "succeeded", payment.reload.status
    assert_equal paid_at, payment.paid_at
    assert_equal "pending_confirmation", order.reload.status
    assert_equal 4, @product.reload.sale_stock
  end

  test "pending webhook stays unpaid until settlement appears in Order and Rental ledgers" do
    order = create_order
    order_payment = initiate_order_payment(order)
    rental = create_rental
    rental_payment = initiate_rental_payment(rental)

    with_gateway do
      [ order_payment, rental_payment ].each do |payment|
        @gateway.set_status(payment.reference, provider_status(payment, "pending"))
        post "/api/v1/webhooks/midtrans", params: signed_notification(payment), as: :json
        assert_response :success
        assert_equal "pending", payment.reload.status
        assert_nil payment.paid_at
      end
    end

    get "/api/v1/customer/orders", headers: @customer_headers
    assert_response :success
    order_ledger = response.parsed_body.find { |entry| entry.fetch("id") == order.id }
    assert_equal "unpaid", order_ledger.fetch("payment_status")
    assert_equal "pending", order_ledger.fetch("payments").first.fetch("status")

    get "/api/v1/customer/rentals", headers: @customer_headers
    assert_response :success
    rental_ledger = response.parsed_body.find { |entry| entry.fetch("id") == rental.id }
    assert_equal "unpaid", rental_ledger.fetch("payment_status")
    assert_equal "pending", rental_ledger.fetch("payments").first.fetch("status")

    with_gateway do
      [ order_payment, rental_payment ].each do |payment|
        @gateway.set_status(payment.reference, provider_status(payment, "settlement"))
        post "/api/v1/webhooks/midtrans", params: signed_notification(payment), as: :json
        assert_response :success
      end
    end

    get "/api/v1/customer/orders", headers: @customer_headers
    assert_response :success
    order_ledger = response.parsed_body.find { |entry| entry.fetch("id") == order.id }
    assert_equal "paid", order_ledger.fetch("payment_status")
    assert_equal "succeeded", order_ledger.fetch("payments").first.fetch("status")

    get "/api/v1/customer/rentals", headers: @customer_headers
    assert_response :success
    rental_ledger = response.parsed_body.find { |entry| entry.fetch("id") == rental.id }
    assert_equal "paid", rental_ledger.fetch("payment_status")
    assert_equal "succeeded", rental_ledger.fetch("payments").first.fetch("status")
    assert_equal "pending_confirmation", order.reload.status
    assert_equal "pending_confirmation", rental.reload.status
    assert_equal 4, @product.reload.sale_stock
    assert_equal 3, @product.rental_stock
  end

  test "late verified settlement is recorded without reviving a cancelled Order" do
    order = create_order
    payment = initiate_order_payment(order)
    @gateway.set_status(payment.reference, provider_status(payment, "expire"))

    with_gateway { post "/api/v1/webhooks/midtrans", params: signed_notification(payment), as: :json }
    assert_response :success
    assert_equal "failed", payment.reload.status

    post "/api/v1/customer/orders/#{order.id}/cancel", headers: @customer_headers, as: :json
    assert_response :success
    @gateway.set_status(payment.reference, provider_status(payment, "settlement"))

    with_gateway { post "/api/v1/webhooks/midtrans", params: signed_notification(payment), as: :json }
    assert_response :success
    assert_equal "succeeded", payment.reload.status
    assert_equal "cancelled", order.reload.status
    assert_equal 4, @product.reload.sale_stock
  end

  test "provider denial fails the Payment without changing Order fulfillment or stock" do
    order = create_order
    payment = initiate_order_payment(order)
    @gateway.set_status(payment.reference, provider_status(payment, "deny"))

    with_gateway { post "/api/v1/webhooks/midtrans", params: signed_notification(payment), as: :json }

    assert_response :success
    assert_equal "failed", payment.reload.status
    assert_equal "deny", payment.provider_transaction_status
    assert_nil payment.paid_at
    assert_equal "pending_confirmation", order.reload.status
    assert_equal 4, @product.reload.sale_stock
  end

  test "webhook rejects invalid signatures and mismatched provider status" do
    order = create_order
    payment = initiate_order_payment(order)
    bad_signature = signed_notification(payment).stringify_keys.merge("signature_key" => "invalid")

    with_gateway { post "/api/v1/webhooks/midtrans", params: bad_signature, as: :json }
    assert_response :unauthorized
    assert_equal "pending", payment.reload.status

    @gateway.set_status(payment.reference, provider_status(payment, "settlement").merge("gross_amount" => "1.00"))
    with_gateway { post "/api/v1/webhooks/midtrans", params: signed_notification(payment), as: :json }
    assert_response :service_unavailable
    assert_equal "pending", payment.reload.status
  end

  test "customer can reconcile own payment but cannot refresh another customer's payment" do
    order = create_order
    payment = initiate_order_payment(order)
    @gateway.set_status(payment.reference, provider_status(payment, "settlement"))

    with_gateway do
      post "/api/v1/customer/payments/#{payment.id}/refresh", headers: @customer_headers, as: :json
    end
    assert_response :success
    assert_equal "succeeded", payment.reload.status

    other_customer = Customer.create!(
      name: "Pelanggan Lain",
      email: "gateway-refresh-other-#{SecureRandom.hex(5)}@example.test"
    )
    with_gateway do
      post "/api/v1/customer/payments/#{payment.id}/refresh",
        headers: customer_headers(other_customer), as: :json
    end
    assert_response :not_found
  end

  private

  def with_gateway(&block)
    original_new = MidtransGateway.method(:new)
    gateway = @gateway
    MidtransGateway.define_singleton_method(:new) { gateway }
    block.call
  ensure
    MidtransGateway.define_singleton_method(:new, original_new)
  end

  def customer_headers(customer)
    user = User.create!(
      name: customer.name,
      email: "user-#{SecureRandom.hex(5)}@example.test",
      password: "GatewayTestPassword!2026",
      password_confirmation: "GatewayTestPassword!2026",
      role: "customer",
      customer: customer
    )
    token = AuthSession.issue_for(user).last
    { "Authorization" => "Bearer #{token}" }
  end

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
      village_name: "Desa Gateway",
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

  def initiate_order_payment(order)
    MidtransPaymentService.new(gateway: @gateway).initiate!(
      transaction: order,
      idempotency_key: "snap-#{SecureRandom.hex(10)}"
    ).fetch(:payment)
  end

  def initiate_rental_payment(rental)
    MidtransPaymentService.new(gateway: @gateway).initiate!(
      transaction: rental,
      idempotency_key: "snap-#{SecureRandom.hex(10)}"
    ).fetch(:payment)
  end

  def provider_status(payment, status)
    {
      "order_id" => payment.reference,
      "gross_amount" => payment.amount.to_s("F"),
      "currency" => "IDR",
      "transaction_status" => status,
      "fraud_status" => "accept",
      "transaction_id" => "midtrans-transaction-#{payment.id}",
      "transaction_time" => Time.current.strftime("%Y-%m-%d %H:%M:%S"),
      "settlement_time" => Time.current.strftime("%Y-%m-%d %H:%M:%S")
    }
  end

  def signed_notification(payment)
    {
      order_id: payment.reference,
      status_code: "200",
      gross_amount: payment.amount.to_s("F"),
      transaction_status: "settlement",
      signature_key: "test-signature"
    }
  end
end
