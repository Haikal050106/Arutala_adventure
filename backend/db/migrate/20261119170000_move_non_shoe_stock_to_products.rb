class MoveNonShoeStockToProducts < ActiveRecord::Migration[8.1]
  def up
    records = connection.select_all(<<~SQL)
      SELECT products.id, products.name, categories.name AS category_name
      FROM products
      INNER JOIN categories ON categories.id = products.category_id
    SQL

    records.each do |product|
      next if "#{product['name']} #{product['category_name']}".match?(/sepatu|footwear|alas kaki/i)

      stock = connection.select_one(
        "SELECT SUM(sale_stock) AS sale_stock, SUM(rental_stock) AS rental_stock " \
        "FROM product_variants WHERE product_id = #{connection.quote(product['id'])} AND active = #{connection.quoted_true}"
      )
      if stock && (stock["sale_stock"] || stock["rental_stock"])
        connection.execute(
          "UPDATE products SET sale_stock = #{connection.quote(stock['sale_stock'].to_i)}, " \
          "rental_stock = #{connection.quote(stock['rental_stock'].to_i)}, updated_at = CURRENT_TIMESTAMP " \
          "WHERE id = #{connection.quote(product['id'])}"
        )
      end
      connection.execute(
        "UPDATE product_variants SET sale_stock = 0, rental_stock = 0, active = #{connection.quoted_false} " \
        "WHERE product_id = #{connection.quote(product['id'])}"
      )
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Product stock totals may have changed since legacy inventory was flattened."
  end
end
