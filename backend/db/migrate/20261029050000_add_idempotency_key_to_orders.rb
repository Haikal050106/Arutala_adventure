class AddIdempotencyKeyToOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :orders, :idempotency_key, :string, limit: 100
    add_index :orders, [ :customer_id, :idempotency_key ], unique: true,
      name: "index_orders_on_customer_id_and_idempotency_key"
  end
end
