# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

category = Category.find_or_create_by!(name: "Perlengkapan Outdoor") do |record|
  record.description = "Perlengkapan untuk kegiatan luar ruang."
end

shoe = Product.find_by(name: "Sepatu Hiking") || Product.create!(
  category: category,
  name: "Sepatu Hiking",
  description: "Pilih model, warna, dan ukuran sepatu hiking yang sesuai.",
  sale_price: 0,
  rent_price_per_day: 0,
  sale_stock: 0,
  rental_stock: 0
)
[ "Trail Run", "High Cut", "Low Cut" ].each do |model_name|
  Product::SHOE_SIZES.each do |size|
    shoe.shoe_inventories.find_or_create_by!(name: model_name, color: "", size: size) do |inventory|
      inventory.sale_stock = 0
      inventory.rental_stock = 0
    end
  end
end

hydropack = Product.find_by(name: "Hydropack") || Product.create!(
  category: category,
  name: "Hydropack",
  description: "Hydropack praktis untuk menemani kegiatan outdoor.",
  sale_price: 0,
  rent_price_per_day: 0,
  sale_stock: 0,
  rental_stock: 0
)
hydropack.update!(sale_price: 0, rent_price_per_day: 0, sale_stock: 0, rental_stock: 0)
