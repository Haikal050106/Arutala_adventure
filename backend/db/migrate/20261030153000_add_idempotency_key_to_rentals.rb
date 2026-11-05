class AddIdempotencyKeyToRentals < ActiveRecord::Migration[8.1]
  def change
    add_column :rentals, :idempotency_key, :string, limit: 100
    add_index :rentals, [ :customer_id, :idempotency_key ], unique: true,
      name: "index_rentals_on_customer_id_and_idempotency_key"
  end
end
