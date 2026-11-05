class AddMidtransCheckoutFieldsToPayments < ActiveRecord::Migration[8.1]
  def change
    add_column :payments, :checkout_token, :string, limit: 255
    add_column :payments, :provider_transaction_status, :string, limit: 40
  end
end
