class RentalItem < ApplicationRecord
  belongs_to :rental
  belongs_to :product

  before_validation :calculate_rental_amounts

  validates :start_date, :return_date, presence: true
  validates :quantity, numericality: { only_integer: true, greater_than: 0 }
  validates :unit_price_per_day, numericality: { greater_than_or_equal_to: 0 }
  validates :rental_days, numericality: { only_integer: true, greater_than: 0 }
  validates :subtotal, numericality: { greater_than_or_equal_to: 0 }
  validates :return_condition, length: { maximum: 500 }, allow_blank: true
  validate :return_date_after_start_date

  private

  def calculate_rental_amounts
    return if start_date.blank? || return_date.blank? || quantity.blank? || unit_price_per_day.blank?

    self.rental_days = (return_date - start_date).to_i
    self.subtotal = rental_days * quantity * unit_price_per_day
  end

  def return_date_after_start_date
    return if start_date.blank? || return_date.blank? || return_date > start_date

    errors.add(:return_date, "harus setelah tanggal mulai.")
  end
end
