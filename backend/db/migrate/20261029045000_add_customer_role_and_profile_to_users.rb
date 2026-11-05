class AddCustomerRoleAndProfileToUsers < ActiveRecord::Migration[8.1]
  def change
    remove_check_constraint :users, name: "users_role_valid"
    add_check_constraint :users, "role IN ('admin', 'cashier', 'customer')", name: "users_role_valid"

    add_reference :users, :customer, null: true, index: { unique: true },
      foreign_key: { on_delete: :cascade }
    add_check_constraint :users, "role != 'customer' OR customer_id IS NOT NULL",
      name: "users_customer_role_requires_profile"
  end
end
