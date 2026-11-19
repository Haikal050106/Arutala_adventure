class ProductPhoto < ApplicationRecord
  belongs_to :product, optional: true
  belongs_to :shoe_inventory, optional: true

  validates :secure_url, :public_id, :alt_text, presence: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :public_id, uniqueness: true
  validate :has_one_owner

  private

  def has_one_owner
    return if product_id.present? ^ shoe_inventory_id.present?

    errors.add(:base, "Foto harus terhubung ke tepat satu produk atau inventori sepatu.")
  end
end
