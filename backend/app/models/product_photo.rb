class ProductPhoto < ApplicationRecord
  belongs_to :product

  validates :secure_url, :public_id, :alt_text, presence: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :public_id, uniqueness: true
end
