class AddModelPreferenceToRentalItems < ActiveRecord::Migration[8.1]
  def change
    add_column :rental_items, :model_preference, :string, limit: 30
  end
end
