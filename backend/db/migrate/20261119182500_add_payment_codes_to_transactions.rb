class AddPaymentCodesToTransactions < ActiveRecord::Migration[8.1]
  def up
    add_column :orders, :payment_code, :string, limit: 17
    add_column :rentals, :payment_code, :string, limit: 17

    create_table :transaction_code_sequences do |t|
      t.date :sequence_date, null: false
      t.integer :last_number, null: false, default: 0
      t.timestamps
    end
    add_index :transaction_code_sequences, :sequence_date, unique: true

    counters = Hash.new(0)
    records = %i[orders rentals].flat_map do |table|
      connection.select_all("SELECT id, created_at FROM #{quote_table_name(table)}").map do |record|
        created_at = Time.zone.parse(record.fetch("created_at"))
        [ table, record.fetch("id"), created_at ]
      end
    end

    records.sort_by { |table, id, created_at| [ created_at, table.to_s, id ] }.each do |table, id, created_at|
      date = created_at.to_date
      counters[date] += 1
      code = "ARU-#{date.strftime('%Y%m%d')}-#{counters.fetch(date).to_s.rjust(4, '0')}"
      execute <<~SQL
        UPDATE #{quote_table_name(table)}
        SET payment_code = #{connection.quote(code)}
        WHERE id = #{connection.quote(id)}
      SQL
    end

    counters.each do |date, last_number|
      now = connection.quote(Time.current)
      execute <<~SQL
        INSERT INTO #{quote_table_name(:transaction_code_sequences)}
          (sequence_date, last_number, created_at, updated_at)
        VALUES (#{connection.quote(date)}, #{last_number}, #{now}, #{now})
      SQL
    end

    change_column_null :orders, :payment_code, false
    change_column_null :rentals, :payment_code, false
    add_index :orders, :payment_code, unique: true
    add_index :rentals, :payment_code, unique: true
  end

  def down
    remove_index :orders, :payment_code
    remove_index :rentals, :payment_code
    remove_column :orders, :payment_code
    remove_column :rentals, :payment_code
    drop_table :transaction_code_sequences
  end
end
