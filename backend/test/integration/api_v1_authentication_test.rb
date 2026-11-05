require "test_helper"

class ApiV1AuthenticationTest < ActionDispatch::IntegrationTest
  test "login returns a bearer token and current-user endpoint returns safe user data" do
    post "/api/v1/auth/login", params: {
      auth: { email: @default_test_user.email, password: "TestAdminPassword!2026" }
    }, as: :json

    assert_response :created
    token = response.parsed_body.fetch("token")
    assert token.present?
    assert_not_includes response.body, "password_digest"
    assert_not_includes response.body, "TestAdminPassword!2026"
    assert_not_equal AuthSession.digest(token), token

    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :success
    assert_equal "admin", response.parsed_body.dig("user", "role")
    assert_equal @default_test_user.email, response.parsed_body.dig("user", "email")
    assert_not_includes response.body, "password_digest"
    assert_not_includes response.body, "token"
  end

  test "wrong password and malformed login receive clear errors" do
    post "/api/v1/auth/login", params: {
      auth: { email: @default_test_user.email, password: "WrongPassword!2026" }
    }, as: :json
    assert_response :unauthorized
    assert_equal "invalid_credentials", response.parsed_body.dig("error", "code")
    assert_not_includes response.body, "password"

    post "/api/v1/auth/login", params: {
      auth: { email: "", password: "" }
    }, as: :json
    assert_response :unprocessable_entity
    assert_equal "invalid_credentials", response.parsed_body.dig("error", "code")
  end

  test "logout revokes the bearer token" do
    token = AuthSession.issue_for(@default_test_user).last

    delete "/api/v1/auth/logout", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :no_content

    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :unauthorized
  end

  test "protected endpoints require authentication while catalog reads remain public" do
    get "/api/v1/orders", headers: { "Authorization" => "" }
    assert_response :unauthorized

    get "/api/v1/customer/orders", headers: { "Authorization" => "" }
    assert_response :unauthorized

    get "/api/v1/customers", headers: { "Authorization" => "" }
    assert_response :unauthorized

    post "/api/v1/categories", params: {
      category: { name: "Tidak Diizinkan", description: "Tidak boleh dibuat tanpa login." }
    }, headers: { "Authorization" => "" }, as: :json
    assert_response :unauthorized

    get "/api/v1/categories", headers: { "Authorization" => "" }
    assert_response :success
  end

  test "Admin can create users but cannot change own role or delete own account" do
    post "/api/v1/users", params: {
      user: {
        name: "Kasir Uji",
        email: "cashier-#{SecureRandom.hex(4)}@example.test",
        password: "CashierPassword!2026",
        password_confirmation: "CashierPassword!2026",
        role: "cashier"
      }
    }, as: :json
    assert_response :created
    cashier_id = response.parsed_body.fetch("id")
    assert_equal "cashier", response.parsed_body.fetch("role")
    assert_not_includes response.body, "password_digest"

    get "/api/v1/users/#{cashier_id}"
    assert_response :success
    assert_equal cashier_id, response.parsed_body.fetch("id")

    patch "/api/v1/users/#{cashier_id}", params: {
      user: { name: "Kasir Diperbarui" }
    }, as: :json
    assert_response :success
    assert_equal "Kasir Diperbarui", response.parsed_body.fetch("name")

    patch "/api/v1/users/#{cashier_id}", params: {
      user: { role: "admin" }
    }, as: :json
    assert_response :success
    assert_equal "admin", response.parsed_body.fetch("role")

    patch "/api/v1/users/#{@default_test_user.id}", params: {
      user: { role: "cashier" }
    }, as: :json
    assert_response :forbidden
    assert_equal "admin", @default_test_user.reload.role

    delete "/api/v1/users/#{@default_test_user.id}"
    assert_response :forbidden
    assert User.exists?(@default_test_user.id)

    delete "/api/v1/users/#{cashier_id}"
    assert_response :no_content
  end

  test "customers and cashiers cannot change their role or create admin accounts" do
    customer_email = "role-customer-#{SecureRandom.hex(4)}@example.test"
    post "/api/v1/auth/customer/register", params: {
      auth: {
        name: "Pelanggan Uji Role",
        email: customer_email,
        phone: "081234567890",
        password: "CustomerPassword!2026",
        password_confirmation: "CustomerPassword!2026",
        role: "admin"
      }
    }, as: :json
    assert_response :created
    customer = User.find_by!(email: customer_email)
    assert_equal "customer", customer.role

    customer_token = response.parsed_body.fetch("token")
    customer_headers = { "Authorization" => [ "Bearer", customer_token ].join(" ") }
    patch "/api/v1/users/#{customer.id}", params: {
      user: { role: "admin" }
    }, headers: customer_headers, as: :json
    assert_response :forbidden
    assert_equal "customer", customer.reload.role

    cashier = User.create!(
      name: "Kasir Uji Role",
      email: "role-cashier-#{SecureRandom.hex(4)}@example.test",
      password: "CashierPassword!2026",
      role: "cashier"
    )
    cashier_token = AuthSession.issue_for(cashier).last
    cashier_headers = { "Authorization" => [ "Bearer", cashier_token ].join(" ") }

    patch "/api/v1/users/#{cashier.id}", params: {
      user: { role: "admin" }
    }, headers: cashier_headers, as: :json
    assert_response :forbidden
    assert_equal "cashier", cashier.reload.role

    assert_no_difference "User.count" do
      [ customer_headers, cashier_headers ].each_with_index do |headers, index|
        post "/api/v1/users", params: {
          user: {
            name: "Admin Tidak Sah",
            email: "unauthorized-admin-#{index}-#{SecureRandom.hex(4)}@example.test",
            password: "AdminPassword!2026",
            password_confirmation: "AdminPassword!2026",
            role: "admin"
          }
        }, headers: headers, as: :json
        assert_response :forbidden
      end
    end
  end

  test "Kasir can operate orders and rentals but cannot access administration endpoints" do
    cashier = User.create!(
      name: "Kasir Operasional",
      email: "operator-#{SecureRandom.hex(4)}@example.test",
      password: "CashierPassword!2026",
      role: "cashier"
    )
    cashier_token = AuthSession.issue_for(cashier).last
    cashier_headers = { "Authorization" => "Bearer #{cashier_token}" }

    get "/api/v1/orders", headers: cashier_headers
    assert_response :success
    get "/api/v1/rentals", headers: cashier_headers
    assert_response :success
    get "/api/v1/customers", headers: cashier_headers
    assert_response :success

    category = Category.create!(name: "Kategori Staf", description: "Untuk uji role.")
    product = Product.create!(
      category: category,
      name: "Produk Staf",
      description: "Untuk transaksi Kasir.",
      sale_price: 50_000,
      rent_price_per_day: 5_000,
      sale_stock: 2,
      rental_stock: 2
    )
    customer = Customer.create!(
      name: "Pelanggan Staf",
      email: "customer-#{SecureRandom.hex(4)}@example.test",
      phone: "081234567890"
    )

    post "/api/v1/orders", params: {
      order: { customer_id: customer.id, items: [ { product_id: product.id, quantity: 1 } ] }
    }, headers: cashier_headers, as: :json
    assert_response :created
    order_id = response.parsed_body.fetch("id")

    post "/api/v1/rentals", params: {
      rental: {
        customer_id: customer.id,
        village_name: "Desa Kasir",
        items: [ {
          product_id: product.id,
          quantity: 1,
          start_date: (Date.current + 1).to_s,
          return_date: (Date.current + 3).to_s
        } ]
      }
    }, headers: cashier_headers, as: :json
    assert_response :created

    patch "/api/v1/orders/#{order_id}", params: {
      order: { status: "confirmed" }
    }, headers: cashier_headers, as: :json
    assert_response :success

    get "/api/v1/users", headers: cashier_headers
    assert_response :forbidden
    post "/api/v1/categories", params: {
      category: { name: "Kasir Tidak Boleh", description: "Admin only." }
    }, headers: cashier_headers, as: :json
    assert_response :forbidden
    post "/api/v1/products", params: { product: {} }, headers: cashier_headers, as: :json
    assert_response :forbidden
    delete "/api/v1/customers/1", headers: cashier_headers
    assert_response :forbidden
    patch "/api/v1/customers/1", params: {
      customer: { name: "Diubah Kasir" }
    }, headers: cashier_headers, as: :json
    assert_response :forbidden
  end

  test "short passwords and unsupported roles are rejected" do
    user = User.new(
      name: "Pengguna Tidak Valid",
      email: "invalid-#{SecureRandom.hex(4)}@example.test",
      password: "short",
      role: "owner"
    )

    assert_not user.valid?
    assert_includes user.errors.attribute_names, :password
    assert_includes user.errors.attribute_names, :role

    long_password_user = User.new(
      name: "Password Terlalu Panjang",
      email: "long-password-#{SecureRandom.hex(4)}@example.test",
      password: "a" * 73,
      role: "cashier"
    )
    assert_not long_password_user.valid?
    assert_includes long_password_user.errors.attribute_names, :password
  end

  test "customer registration creates a linked account and session atomically without accepting a role" do
    email = "customer-#{SecureRandom.hex(4)}@example.test"

    assert_difference [ "User.count", "Customer.count", "AuthSession.count" ], 1 do
      post "/api/v1/auth/customer/register", params: {
        auth: {
          name: "Pelanggan Baru",
          email: email,
          phone: "+628123456789",
          password: "CustomerPassword!2026",
          password_confirmation: "CustomerPassword!2026",
          role: "admin"
        }
      }, as: :json
    end

    assert_response :created
    user = User.find_by!(email: email)
    customer = Customer.find_by!(email: email)
    assert_equal "customer", user.role
    assert_equal customer, user.customer
    assert_equal user, customer.user
    assert_equal "customer", response.parsed_body.dig("user", "role")
    assert_equal email, response.parsed_body.dig("customer", "email")
    assert_equal customer.id, response.parsed_body.dig("customer", "id")
    assert response.parsed_body.fetch("token").present?
    assert_not_includes response.body, "password_digest"
    assert_not_includes response.body, "token_digest"
    assert_not_includes response.body, "CustomerPassword!2026"
  end

  test "customer registration validates profile data and password limits without partial records" do
    assert_no_difference [ "User.count", "Customer.count", "AuthSession.count" ] do
      post "/api/v1/auth/customer/register", params: {
        auth: {
          name: "",
          email: "invalid-email",
          phone: "12",
          password: "short"
        }
      }, as: :json
      assert_response :unprocessable_entity

      post "/api/v1/auth/customer/register", params: {
        auth: {
          name: "Pelanggan Panjang",
          email: "long-password-#{SecureRandom.hex(4)}@example.test",
          phone: "081234567890",
          password: "a" * 73
        }
      }, as: :json
      assert_response :unprocessable_entity
    end
  end

  test "customer registration rejects existing user and legacy customer emails without linking" do
    legacy_email = "legacy-#{SecureRandom.hex(4)}@example.test"
    legacy_customer = Customer.create!(
      name: "Pelanggan Lama",
      email: legacy_email,
      phone: "081234567890"
    )

    assert_no_difference [ "User.count", "Customer.count", "AuthSession.count" ] do
      [ @default_test_user.email, legacy_email ].each do |email|
        post "/api/v1/auth/customer/register", params: {
          auth: {
            name: "Tidak Terdaftar",
            email: email,
            phone: "081234567890",
            password: "CustomerPassword!2026"
          }
        }, as: :json
        assert_response :conflict
        assert_equal "email_conflict", response.parsed_body.dig("error", "code")
      end
    end

    assert_nil legacy_customer.reload.user
  end

  test "customer login issues a session, customer logout revokes it, and staff login remains separate" do
    email = "login-customer-#{SecureRandom.hex(4)}@example.test"
    post "/api/v1/auth/customer/register", params: {
      auth: {
        name: "Pelanggan Login",
        email: email,
        phone: "081234567890",
        password: "CustomerPassword!2026"
      }
    }, as: :json
    assert_response :created

    post "/api/v1/auth/customer/login", params: {
      auth: { email: email, password: "CustomerPassword!2026" }
    }, as: :json
    assert_response :created
    token = response.parsed_body.fetch("token")
    assert_equal "customer", response.parsed_body.dig("user", "role")
    assert_not_includes response.body, "token_digest"

    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :success
    assert_equal "customer", response.parsed_body.dig("user", "role")

    delete "/api/v1/auth/logout", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :no_content
    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :unauthorized

    post "/api/v1/auth/login", params: {
      auth: { email: email, password: "CustomerPassword!2026" }
    }, as: :json
    assert_response :unauthorized
  end

  test "customer current-session response includes the linked customer profile" do
    email = "profile-customer-#{SecureRandom.hex(4)}@example.test"
    post "/api/v1/auth/customer/register", params: {
      auth: {
        name: "Pelanggan Profil",
        email: email,
        phone: "081234567890",
        password: "CustomerPassword!2026"
      }
    }, as: :json
    assert_response :created
    token = response.parsed_body.fetch("token")

    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }

    assert_response :success
    assert_equal "customer", response.parsed_body.dig("user", "role")
    assert_equal email, response.parsed_body.dig("customer", "email")
  end

  test "customer tokens cannot access staff endpoints" do
    email = "blocked-customer-#{SecureRandom.hex(4)}@example.test"
    post "/api/v1/auth/customer/register", params: {
      auth: {
        name: "Pelanggan Terbatas",
        email: email,
        phone: "081234567890",
        password: "CustomerPassword!2026"
      }
    }, as: :json
    assert_response :created
    token = response.parsed_body.fetch("token")
    customer_headers = { "Authorization" => "Bearer #{token}" }

    [ "/api/v1/orders", "/api/v1/rentals", "/api/v1/customers", "/api/v1/users" ].each do |path|
      get path, headers: customer_headers
      assert_response :forbidden
    end
  end

  test "password reset revokes existing sessions" do
    token = AuthSession.issue_for(@default_test_user).last

    patch "/api/v1/users/#{@default_test_user.id}", params: {
      user: {
        password: "ChangedPassword!2026",
        password_confirmation: "ChangedPassword!2026"
      }
    }, as: :json
    assert_response :success

    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }
    assert_response :unauthorized
  end
end
