class CreateProductPhotos < ActiveRecord::Migration[8.1]
  def change
    create_table :product_photos do |t|
      t.references :product, null: false, foreign_key: { on_delete: :cascade }
      t.string :secure_url, null: false, limit: 2048
      t.string :public_id, null: false, limit: 255
      t.string :alt_text, null: false, limit: 255
      t.integer :position, null: false, default: 0
      t.boolean :is_primary, null: false, default: false

      t.timestamps
    end
    add_index :product_photos, %i[product_id position]
    add_index :product_photos, :public_id, unique: true
    add_index :product_photos, :product_id, unique: true, where: "is_primary = 1",
      name: "index_product_photos_one_primary_per_product"
  end
end
