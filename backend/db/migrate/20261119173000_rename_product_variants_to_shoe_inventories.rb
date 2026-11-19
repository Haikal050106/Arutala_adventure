class RenameProductVariantsToShoeInventories < ActiveRecord::Migration[8.1]
  SNAPSHOT_COLUMNS = {
    variant_name: :inventory_model_name,
    variant_design_name: :inventory_design_name,
    variant_color: :inventory_color,
    variant_size: :inventory_size,
    variant_options: :inventory_attributes
  }.freeze
  def up
    rename_table :product_variants, :shoe_inventories
    rename_column :order_items, :product_variant_id, :shoe_inventory_id
    rename_column :rental_items, :product_variant_id, :shoe_inventory_id
    remove_check_constraint :product_photos, name: "product_photos_exactly_one_owner"
    rename_column :product_photos, :product_variant_id, :shoe_inventory_id
    add_check_constraint :product_photos,
      "(product_id IS NOT NULL AND shoe_inventory_id IS NULL) OR (product_id IS NULL AND shoe_inventory_id IS NOT NULL)",
      name: "product_photos_exactly_one_owner"
    SNAPSHOT_COLUMNS.each do |old_name, new_name|
      rename_column :order_items, old_name, new_name
      rename_column :rental_items, old_name, new_name
    end
    rename_index :product_photos, "index_product_photos_one_primary_per_variant",
      "index_product_photos_one_primary_per_shoe_inventory"
  end

  def down
    rename_index :product_photos, "index_product_photos_one_primary_per_shoe_inventory",
      "index_product_photos_one_primary_per_variant"
    SNAPSHOT_COLUMNS.to_a.reverse_each do |old_name, new_name|
      rename_column :rental_items, new_name, old_name
      rename_column :order_items, new_name, old_name
    end
    remove_check_constraint :product_photos, name: "product_photos_exactly_one_owner"
    rename_column :product_photos, :shoe_inventory_id, :product_variant_id
    add_check_constraint :product_photos,
      "(product_id IS NOT NULL AND product_variant_id IS NULL) OR (product_id IS NULL AND product_variant_id IS NOT NULL)",
      name: "product_photos_exactly_one_owner"
    rename_column :rental_items, :shoe_inventory_id, :product_variant_id
    rename_column :order_items, :shoe_inventory_id, :product_variant_id
    rename_table :shoe_inventories, :product_variants
  end
end
