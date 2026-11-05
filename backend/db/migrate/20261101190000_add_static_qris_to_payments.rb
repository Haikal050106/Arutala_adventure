class AddStaticQrisToPayments < ActiveRecord::Migration[8.1]
  def up
    remove_check_constraint :payments, name: "payments_method_valid"
    add_check_constraint :payments, "method IN ('cash', 'gateway', 'qris')", name: "payments_method_valid"
    add_reference :payments, :confirmed_by, foreign_key: { to_table: :users, on_delete: :nullify }
  end

  def down
    remove_reference :payments, :confirmed_by, foreign_key: { to_table: :users }
    remove_check_constraint :payments, name: "payments_method_valid"
    add_check_constraint :payments, "method IN ('cash', 'gateway')", name: "payments_method_valid"
  end
end
