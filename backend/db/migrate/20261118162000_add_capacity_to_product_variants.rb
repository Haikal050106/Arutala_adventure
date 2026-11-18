class AddCapacityToProductVariants < ActiveRecord::Migration[8.1]
  def change
    add_column :product_variants, :capacity, :string, null: false, default: "", limit: 40

    remove_index :product_variants, name: "index_product_variants_on_product_model_design_options"
    add_index :product_variants, %i[product_id name design_name color size capacity], unique: true,
      name: "index_product_variants_on_product_model_design_inventory"
  end
end
