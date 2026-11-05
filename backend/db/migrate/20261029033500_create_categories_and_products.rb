class CreateCategoriesAndProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :categories do |t|
      t.string :name, null: false, limit: 60
      t.string :description, null: false, limit: 250

      t.timestamps
    end
    add_index :categories, :name, unique: true

    create_table :products do |t|
      t.references :category, null: false, foreign_key: true
      t.string :slug, null: false
      t.string :name, null: false, limit: 100
      t.string :description, null: false, limit: 500
      t.decimal :sale_price, null: false, precision: 12, scale: 2
      t.decimal :rent_price_per_day, null: false, precision: 12, scale: 2
      t.integer :sale_stock, null: false, default: 0
      t.integer :rental_stock, null: false, default: 0
      t.boolean :featured, null: false, default: false
      t.string :image_url
      t.string :image_alt

      t.timestamps
    end
    add_index :products, :slug, unique: true
    add_check_constraint :products, "sale_price >= 0", name: "products_sale_price_nonnegative"
    add_check_constraint :products, "rent_price_per_day >= 0", name: "products_rent_price_nonnegative"
    add_check_constraint :products, "sale_stock >= 0", name: "products_sale_stock_nonnegative"
    add_check_constraint :products, "rental_stock >= 0", name: "products_rental_stock_nonnegative"
  end
end
