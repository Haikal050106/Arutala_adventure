class CreateProductVariants < ActiveRecord::Migration[8.1]
  def change
    create_table :product_variants do |t|
      t.references :product, null: false, foreign_key: true
      t.string :name, null: false, limit: 100
      t.string :color, null: false, default: "", limit: 60
      t.string :size, null: false, default: "", limit: 40
      t.json :options, null: false, default: {}
      t.decimal :sale_price, precision: 12, scale: 2
      t.decimal :rent_price_per_day, precision: 12, scale: 2
      t.integer :sale_stock, null: false, default: 0
      t.integer :rental_stock, null: false, default: 0
      t.string :image_url, limit: 2048
      t.string :image_alt, limit: 255
      t.boolean :active, null: false, default: true

      t.timestamps
    end
    add_index :product_variants, %i[product_id name color size], unique: true,
      name: "index_product_variants_on_product_and_options"
    add_check_constraint :product_variants, "sale_price IS NULL OR sale_price >= 0",
      name: "product_variants_sale_price_nonnegative"
    add_check_constraint :product_variants, "rent_price_per_day IS NULL OR rent_price_per_day >= 0",
      name: "product_variants_rent_price_nonnegative"
    add_check_constraint :product_variants, "sale_stock >= 0", name: "product_variants_sale_stock_nonnegative"
    add_check_constraint :product_variants, "rental_stock >= 0", name: "product_variants_rental_stock_nonnegative"

    add_reference :product_photos, :product_variant, foreign_key: true
    change_column_null :product_photos, :product_id, true
    add_check_constraint :product_photos,
      "(product_id IS NOT NULL AND product_variant_id IS NULL) OR (product_id IS NULL AND product_variant_id IS NOT NULL)",
      name: "product_photos_exactly_one_owner"
    add_index :product_photos, :product_variant_id, unique: true,
      where: "is_primary = 1", name: "index_product_photos_one_primary_per_variant"

    add_reference :order_items, :product_variant, foreign_key: true
    add_column :order_items, :variant_name, :string, limit: 100
    add_column :order_items, :variant_color, :string, limit: 60
    add_column :order_items, :variant_size, :string, limit: 40
    add_column :order_items, :variant_options, :json, null: false, default: {}

    add_reference :rental_items, :product_variant, foreign_key: true
    add_column :rental_items, :variant_name, :string, limit: 100
    add_column :rental_items, :variant_color, :string, limit: 60
    add_column :rental_items, :variant_size, :string, limit: 40
    add_column :rental_items, :variant_options, :json, null: false, default: {}
  end
end
