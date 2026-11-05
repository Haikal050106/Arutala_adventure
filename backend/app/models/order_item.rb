class OrderItem < ApplicationRecord
  belongs_to :order
  belongs_to :product

  before_validation :calculate_subtotal

  validates :quantity, numericality: { only_integer: true, greater_than: 0 }
  validates :unit_price, numericality: { greater_than_or_equal_to: 0 }
  validates :subtotal, numericality: { greater_than_or_equal_to: 0 }

  private

  def calculate_subtotal
    return if quantity.blank? || unit_price.blank?

    self.subtotal = quantity * unit_price
  end
end
