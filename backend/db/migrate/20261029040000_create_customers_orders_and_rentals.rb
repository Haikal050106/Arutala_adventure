class CreateCustomersOrdersAndRentals < ActiveRecord::Migration[8.1]
  def change
    create_table :customers do |t|
      t.string :name, null: false, limit: 100
      t.string :email, null: false, limit: 150
      t.string :phone, null: false, limit: 20
      t.string :village_name, limit: 150

      t.timestamps
    end
    add_index :customers, :email, unique: true

    create_table :orders do |t|
      t.references :customer, null: false, foreign_key: { on_delete: :restrict }
      t.string :order_number, null: false, limit: 32
      t.string :status, null: false, default: "pending_confirmation"
      t.text :notes
      t.decimal :total_amount, null: false, precision: 14, scale: 2, default: 0
      t.boolean :stock_deducted, null: false, default: false

      t.timestamps
    end
    add_index :orders, :order_number, unique: true
    add_index :orders, :status
    add_check_constraint :orders, "total_amount >= 0", name: "orders_total_nonnegative"

    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: { on_delete: :cascade }
      t.references :product, null: false, foreign_key: { on_delete: :restrict }
      t.integer :quantity, null: false
      t.decimal :unit_price, null: false, precision: 12, scale: 2
      t.decimal :subtotal, null: false, precision: 14, scale: 2

      t.timestamps
    end
    add_check_constraint :order_items, "quantity > 0", name: "order_items_quantity_positive"
    add_check_constraint :order_items, "unit_price >= 0", name: "order_items_unit_price_nonnegative"
    add_check_constraint :order_items, "subtotal >= 0", name: "order_items_subtotal_nonnegative"

    create_table :rentals do |t|
      t.references :customer, null: false, foreign_key: { on_delete: :restrict }
      t.string :rental_number, null: false, limit: 32
      t.string :village_name, null: false, limit: 150
      t.string :status, null: false, default: "pending_confirmation"
      t.string :return_status, null: false, default: "not_returned"
      t.text :notes
      t.decimal :total_amount, null: false, precision: 14, scale: 2, default: 0

      t.timestamps
    end
    add_index :rentals, :rental_number, unique: true
    add_index :rentals, :status
    add_check_constraint :rentals, "total_amount >= 0", name: "rentals_total_nonnegative"

    create_table :rental_items do |t|
      t.references :rental, null: false, foreign_key: { on_delete: :cascade }
      t.references :product, null: false, foreign_key: { on_delete: :restrict }
      t.date :start_date, null: false
      t.date :return_date, null: false
      t.integer :quantity, null: false
      t.decimal :unit_price_per_day, null: false, precision: 12, scale: 2
      t.integer :rental_days, null: false
      t.decimal :subtotal, null: false, precision: 14, scale: 2

      t.timestamps
    end
    add_index :rental_items, %i[product_id start_date return_date]
    add_check_constraint :rental_items, "return_date > start_date", name: "rental_items_dates_in_order"
    add_check_constraint :rental_items, "quantity > 0", name: "rental_items_quantity_positive"
    add_check_constraint :rental_items, "unit_price_per_day >= 0", name: "rental_items_daily_price_nonnegative"
    add_check_constraint :rental_items, "rental_days > 0", name: "rental_items_days_positive"
    add_check_constraint :rental_items, "subtotal >= 0", name: "rental_items_subtotal_nonnegative"
  end
end
