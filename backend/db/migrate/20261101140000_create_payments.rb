class CreatePayments < ActiveRecord::Migration[8.1]
  def change
    create_table :payments do |t|
      t.references :order, foreign_key: { on_delete: :restrict }
      t.references :rental, foreign_key: { on_delete: :restrict }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.decimal :amount, null: false, precision: 14, scale: 2
      t.decimal :cash_received, precision: 14, scale: 2
      t.decimal :change_amount, precision: 14, scale: 2
      t.string :currency, null: false, default: "IDR", limit: 3
      t.string :method, null: false, limit: 20
      t.string :status, null: false, default: "pending", limit: 20
      t.string :reference, null: false, limit: 40
      t.string :idempotency_key, null: false, limit: 100
      t.string :provider, limit: 40
      t.string :provider_reference, limit: 150
      t.text :checkout_url
      t.datetime :expires_at
      t.datetime :paid_at

      t.timestamps
    end

    add_index :payments, :reference, unique: true
    add_index :payments, :idempotency_key, unique: true
    add_index :payments, :provider_reference, unique: true
    add_index :payments, [ :order_id, :status ]
    add_index :payments, [ :rental_id, :status ]
    add_check_constraint :payments, "(order_id IS NOT NULL AND rental_id IS NULL) OR (order_id IS NULL AND rental_id IS NOT NULL)", name: "payments_exactly_one_transaction"
    add_check_constraint :payments, "amount > 0", name: "payments_amount_positive"
    add_check_constraint :payments, "currency = 'IDR'", name: "payments_currency_idr"
    add_check_constraint :payments, "method IN ('cash', 'gateway')", name: "payments_method_valid"
    add_check_constraint :payments, "status IN ('pending', 'succeeded', 'failed', 'refunded')", name: "payments_status_valid"
    add_check_constraint :payments, "cash_received IS NULL OR cash_received >= amount", name: "payments_cash_received_sufficient"
    add_check_constraint :payments, "change_amount IS NULL OR change_amount >= 0", name: "payments_change_nonnegative"
  end
end
