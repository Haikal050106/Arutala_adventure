class AddStockDeductedToRentals < ActiveRecord::Migration[8.1]
  def change
    add_column :rentals, :stock_deducted, :boolean, default: false, null: false
  end
end
