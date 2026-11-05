class AllowOfflineCustomers < ActiveRecord::Migration[8.1]
  def change
    change_column_null :customers, :email, true
    change_column_null :customers, :phone, true
  end
end
