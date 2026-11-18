class AddDesignNameToProductVariants < ActiveRecord::Migration[8.1]
  def change
    add_column :product_variants, :design_name, :string, null: false, default: "Default", limit: 100

    remove_index :product_variants, name: "index_product_variants_on_product_and_options"
    add_index :product_variants, %i[product_id name design_name color size], unique: true,
      name: "index_product_variants_on_product_model_design_options"

    add_column :order_items, :variant_design_name, :string, limit: 100
    add_column :rental_items, :variant_design_name, :string, limit: 100
  end
end
