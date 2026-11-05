require "test_helper"

class MidtransGatewayTest < ActiveSupport::TestCase
  test "requires sandbox credentials and rejects production mode" do
    with_midtrans_environment("MIDTRANS_ENV" => "production") do
      assert_raises(MidtransGateway::ConfigurationError) { MidtransGateway.new }
    end

    with_midtrans_environment("MIDTRANS_ENV" => "sandbox", "MIDTRANS_SERVER_KEY" => nil, "MIDTRANS_CLIENT_KEY" => nil) do
      assert_raises(MidtransGateway::ConfigurationError) { MidtransGateway.new }
    end
  end

  test "validates the Midtrans SHA512 notification signature" do
    with_midtrans_environment(
      "MIDTRANS_ENV" => "sandbox",
      "MIDTRANS_SERVER_KEY" => "SB-Mid-server-test",
      "MIDTRANS_CLIENT_KEY" => "SB-Mid-client-test"
    ) do
      gateway = MidtransGateway.new
      notification = {
        "order_id" => "PAY-TEST-1",
        "status_code" => "200",
        "gross_amount" => "125000.00"
      }
      notification["signature_key"] = Digest::SHA512.hexdigest(
        "PAY-TEST-1200125000.00SB-Mid-server-test"
      )

      assert gateway.valid_signature?(notification)
      refute gateway.valid_signature?(notification.merge("gross_amount" => "1.00"))
    end
  end

  private

  def with_midtrans_environment(values)
    previous_values = values.to_h { |key, _value| [ key, ENV[key] ] }
    values.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    yield
  ensure
    previous_values.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end
end
