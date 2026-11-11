# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_11_213000) do
  create_table "auth_sessions", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "token_digest", limit: 64, null: false
    t.datetime "expires_at", null: false
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_auth_sessions_on_expires_at"
    t.index ["token_digest"], name: "index_auth_sessions_on_token_digest", unique: true
    t.index ["user_id"], name: "index_auth_sessions_on_user_id"
  end

  create_table "categories", force: :cascade do |t|
    t.string "name", limit: 60, null: false
    t.string "description", limit: 250, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_categories_on_name", unique: true
  end

  create_table "customers", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.string "email", limit: 150
    t.string "phone", limit: 20
    t.string "village_name", limit: 150
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_customers_on_email", unique: true
  end

  create_table "order_items", force: :cascade do |t|
    t.integer "order_id", null: false
    t.integer "product_id", null: false
    t.integer "quantity", null: false
    t.decimal "unit_price", precision: 12, scale: 2, null: false
    t.decimal "subtotal", precision: 14, scale: 2, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_order_items_on_order_id"
    t.index ["product_id"], name: "index_order_items_on_product_id"
    t.check_constraint "quantity > 0", name: "order_items_quantity_positive"
    t.check_constraint "subtotal >= 0", name: "order_items_subtotal_nonnegative"
    t.check_constraint "unit_price >= 0", name: "order_items_unit_price_nonnegative"
  end

  create_table "orders", force: :cascade do |t|
    t.integer "customer_id", null: false
    t.string "order_number", limit: 32, null: false
    t.string "status", default: "pending_confirmation", null: false
    t.text "notes"
    t.decimal "total_amount", precision: 14, scale: 2, default: "0.0", null: false
    t.boolean "stock_deducted", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "idempotency_key", limit: 100
    t.index ["customer_id", "idempotency_key"], name: "index_orders_on_customer_id_and_idempotency_key", unique: true
    t.index ["customer_id"], name: "index_orders_on_customer_id"
    t.index ["order_number"], name: "index_orders_on_order_number", unique: true
    t.index ["status"], name: "index_orders_on_status"
    t.check_constraint "total_amount >= 0", name: "orders_total_nonnegative"
  end

  create_table "payments", force: :cascade do |t|
    t.integer "order_id"
    t.integer "rental_id"
    t.integer "created_by_id"
    t.decimal "amount", precision: 14, scale: 2, null: false
    t.decimal "cash_received", precision: 14, scale: 2
    t.decimal "change_amount", precision: 14, scale: 2
    t.string "currency", limit: 3, default: "IDR", null: false
    t.string "method", limit: 20, null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.string "reference", limit: 40, null: false
    t.string "idempotency_key", limit: 100, null: false
    t.string "provider", limit: 40
    t.string "provider_reference", limit: 150
    t.text "checkout_url"
    t.datetime "expires_at"
    t.datetime "paid_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "checkout_token", limit: 255
    t.string "provider_transaction_status", limit: 40
    t.integer "confirmed_by_id"
    t.index ["confirmed_by_id"], name: "index_payments_on_confirmed_by_id"
    t.index ["created_by_id"], name: "index_payments_on_created_by_id"
    t.index ["idempotency_key"], name: "index_payments_on_idempotency_key", unique: true
    t.index ["order_id", "status"], name: "index_payments_on_order_id_and_status"
    t.index ["order_id"], name: "index_payments_on_order_id"
    t.index ["provider_reference"], name: "index_payments_on_provider_reference", unique: true
    t.index ["reference"], name: "index_payments_on_reference", unique: true
    t.index ["rental_id", "status"], name: "index_payments_on_rental_id_and_status"
    t.index ["rental_id"], name: "index_payments_on_rental_id"
    t.check_constraint "(order_id IS NOT NULL AND rental_id IS NULL) OR (order_id IS NULL AND rental_id IS NOT NULL)", name: "payments_exactly_one_transaction"
    t.check_constraint "amount > 0", name: "payments_amount_positive"
    t.check_constraint "cash_received IS NULL OR cash_received >= amount", name: "payments_cash_received_sufficient"
    t.check_constraint "change_amount IS NULL OR change_amount >= 0", name: "payments_change_nonnegative"
    t.check_constraint "currency = 'IDR'", name: "payments_currency_idr"
    t.check_constraint "method IN ('cash', 'gateway', 'qris')", name: "payments_method_valid"
    t.check_constraint "status IN ('pending', 'succeeded', 'failed', 'refunded')", name: "payments_status_valid"
  end

  create_table "product_photos", force: :cascade do |t|
    t.integer "product_id", null: false
    t.string "secure_url", limit: 2048, null: false
    t.string "public_id", limit: 255, null: false
    t.string "alt_text", limit: 255, null: false
    t.integer "position", default: 0, null: false
    t.boolean "is_primary", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id", "position"], name: "index_product_photos_on_product_id_and_position"
    t.index ["product_id"], name: "index_product_photos_on_product_id"
    t.index ["product_id"], name: "index_product_photos_one_primary_per_product", unique: true, where: "is_primary = 1"
    t.index ["public_id"], name: "index_product_photos_on_public_id", unique: true
  end

  create_table "products", force: :cascade do |t|
    t.integer "category_id", null: false
    t.string "slug", null: false
    t.string "name", limit: 100, null: false
    t.string "description", limit: 500, null: false
    t.decimal "sale_price", precision: 12, scale: 2, null: false
    t.decimal "rent_price_per_day", precision: 12, scale: 2, null: false
    t.integer "sale_stock", default: 0, null: false
    t.integer "rental_stock", default: 0, null: false
    t.boolean "featured", default: false, null: false
    t.string "image_url"
    t.string "image_alt"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_products_on_category_id"
    t.index ["slug"], name: "index_products_on_slug", unique: true
    t.check_constraint "rent_price_per_day >= 0", name: "products_rent_price_nonnegative"
    t.check_constraint "rental_stock >= 0", name: "products_rental_stock_nonnegative"
    t.check_constraint "sale_price >= 0", name: "products_sale_price_nonnegative"
    t.check_constraint "sale_stock >= 0", name: "products_sale_stock_nonnegative"
  end

  create_table "rental_items", force: :cascade do |t|
    t.integer "rental_id", null: false
    t.integer "product_id", null: false
    t.date "start_date", null: false
    t.date "return_date", null: false
    t.integer "quantity", null: false
    t.decimal "unit_price_per_day", precision: 12, scale: 2, null: false
    t.integer "rental_days", null: false
    t.decimal "subtotal", precision: 14, scale: 2, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "return_condition"
    t.index ["product_id", "start_date", "return_date"], name: "idx_on_product_id_start_date_return_date_845de10e75"
    t.index ["product_id"], name: "index_rental_items_on_product_id"
    t.index ["rental_id"], name: "index_rental_items_on_rental_id"
    t.check_constraint "quantity > 0", name: "rental_items_quantity_positive"
    t.check_constraint "rental_days > 0", name: "rental_items_days_positive"
    t.check_constraint "return_date > start_date", name: "rental_items_dates_in_order"
    t.check_constraint "subtotal >= 0", name: "rental_items_subtotal_nonnegative"
    t.check_constraint "unit_price_per_day >= 0", name: "rental_items_daily_price_nonnegative"
  end

  create_table "rental_status_histories", force: :cascade do |t|
    t.integer "rental_id", null: false
    t.integer "changed_by_id"
    t.string "from_status"
    t.string "to_status", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["changed_by_id"], name: "index_rental_status_histories_on_changed_by_id"
    t.index ["rental_id"], name: "index_rental_status_histories_on_rental_id"
  end

  create_table "rentals", force: :cascade do |t|
    t.integer "customer_id", null: false
    t.string "rental_number", limit: 32, null: false
    t.string "village_name", limit: 150, null: false
    t.string "status", default: "pending_confirmation", null: false
    t.string "return_status", default: "not_returned", null: false
    t.text "notes"
    t.decimal "total_amount", precision: 14, scale: 2, default: "0.0", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "idempotency_key", limit: 100
    t.datetime "actual_returned_at"
    t.boolean "stock_deducted", default: false, null: false
    t.index ["customer_id", "idempotency_key"], name: "index_rentals_on_customer_id_and_idempotency_key", unique: true
    t.index ["customer_id"], name: "index_rentals_on_customer_id"
    t.index ["rental_number"], name: "index_rentals_on_rental_number", unique: true
    t.index ["status"], name: "index_rentals_on_status"
    t.check_constraint "total_amount >= 0", name: "rentals_total_nonnegative"
  end

  create_table "users", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.string "email", limit: 150, null: false
    t.string "password_digest", null: false
    t.string "role", default: "cashier", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "customer_id"
    t.index ["customer_id"], name: "index_users_on_customer_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["role"], name: "index_users_on_role"
    t.check_constraint "role != 'customer' OR customer_id IS NOT NULL", name: "users_customer_role_requires_profile"
    t.check_constraint "role IN ('admin', 'cashier', 'customer')", name: "users_role_valid"
  end

  add_foreign_key "auth_sessions", "users", on_delete: :cascade
  add_foreign_key "order_items", "orders", on_delete: :cascade
  add_foreign_key "order_items", "products", on_delete: :restrict
  add_foreign_key "orders", "customers", on_delete: :restrict
  add_foreign_key "payments", "orders", on_delete: :restrict
  add_foreign_key "payments", "rentals", on_delete: :restrict
  add_foreign_key "payments", "users", column: "confirmed_by_id", on_delete: :nullify
  add_foreign_key "payments", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "product_photos", "products", on_delete: :cascade
  add_foreign_key "products", "categories"
  add_foreign_key "rental_items", "products", on_delete: :restrict
  add_foreign_key "rental_items", "rentals", on_delete: :cascade
  add_foreign_key "rental_status_histories", "rentals"
  add_foreign_key "rental_status_histories", "users", column: "changed_by_id", on_delete: :nullify
  add_foreign_key "rentals", "customers", on_delete: :restrict
  add_foreign_key "users", "customers", on_delete: :cascade
end
