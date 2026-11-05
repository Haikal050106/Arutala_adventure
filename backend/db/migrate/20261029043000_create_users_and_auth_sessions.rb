class CreateUsersAndAuthSessions < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :name, null: false, limit: 100
      t.string :email, null: false, limit: 150
      t.string :password_digest, null: false
      t.string :role, null: false, default: "cashier"

      t.timestamps
    end
    add_index :users, :email, unique: true
    add_index :users, :role
    add_check_constraint :users, "role IN ('admin', 'cashier')", name: "users_role_valid"

    create_table :auth_sessions do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :token_digest, null: false, limit: 64
      t.datetime :expires_at, null: false
      t.datetime :revoked_at

      t.timestamps
    end
    add_index :auth_sessions, :token_digest, unique: true
    add_index :auth_sessions, :expires_at
  end
end
