require "test_helper"

class RentalConfirmationConcurrencyTest < ActionDispatch::IntegrationTest
  self.use_transactional_tests = false

  def setup
    super
    @category = Category.create!(
      name: "Kategori Concurrency #{SecureRandom.hex(4)}",
      description: "Kategori untuk pengujian concurrency."
    )
    @product = Product.create!(
      category: @category,
      name: "Produk Concurrency #{SecureRandom.hex(4)}",
      description: "Produk untuk pengujian konfirmasi bersamaan.",
      sale_price: 100_000,
      rent_price_per_day: 10_000,
      sale_stock: 1,
      rental_stock: 2
    )
    @customer = Customer.create!(
      name: "Pelanggan Concurrency",
      email: "rental-concurrency-#{SecureRandom.hex(4)}@example.test",
      phone: "081234567890"
    )
    @rentals = [
      create_rental(start_date: Date.current + 30),
      create_rental(start_date: Date.current + 30)
    ]
    @auth_session, @raw_token = AuthSession.issue_for(@default_test_user)
  end

  def teardown
    @rentals&.each(&:destroy!)
    @auth_session&.destroy!
    @customer&.destroy!
    @product&.destroy!
    @category&.destroy!
    super
  end

  test "simultaneous confirmations preserve valid overlapping reservations" do
    ready = Queue.new
    start = Queue.new
    results = Queue.new

    workers = @rentals.map do |rental|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          session = ActionDispatch::Integration::Session.new(Rails.application)
          ready << true
          start.pop
          session.patch(
            "/api/v1/rentals/#{rental.id}",
            params: { rental: { status: "confirmed" } },
            headers: { "Authorization" => "Bearer #{@raw_token}" },
            as: :json
          )
          results << [ rental.id, session.response.status, session.response.parsed_body ]
        end
      rescue StandardError => error
        results << [ rental.id, :error, error ]
      end
    end

    @rentals.length.times { ready.pop }
    @rentals.length.times { start << true }
    workers.each(&:join)
    outcomes = @rentals.length.times.map { results.pop }

    errors = outcomes.select { |(_, status, _)| status == :error }
    assert_empty errors, errors.map { |(_, _, error)| "#{error.class}: #{error.message}" }.join("\n")

    assert_equal [ 200, 200 ], outcomes.map { |(_, status, _)| status }.sort
    assert_equal 2, @product.reload.rental_stock
    assert_operator @product.rental_stock, :>=, 0

    confirmed_rentals = Rental.where(id: @rentals.map(&:id), status: "confirmed")
    assert_equal 2, confirmed_rentals.count
    assert confirmed_rentals.none?(&:stock_deducted?)
    assert_equal 2, RentalStatusHistory.where(rental_id: @rentals.map(&:id), to_status: "confirmed").count
  end

  private

  def create_rental(start_date:)
    Rental.create_booking!(
      customer: @customer,
      village_name: "Desa Uji",
      notes: nil,
      items: [ {
        product_id: @product.id,
        quantity: 1,
        start_date: start_date.iso8601,
        return_date: (start_date + 2).iso8601
      } ]
    )
  end
end
