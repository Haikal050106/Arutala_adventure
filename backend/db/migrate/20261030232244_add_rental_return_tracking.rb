class AddRentalReturnTracking < ActiveRecord::Migration[8.1]
  def change
    add_column :rentals, :actual_returned_at, :datetime
    add_column :rental_items, :return_condition, :text

    create_table :rental_status_histories do |t|
      t.references :rental, null: false, foreign_key: true
      t.references :changed_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :from_status
      t.string :to_status, null: false
      t.timestamps
    end
  end
end
