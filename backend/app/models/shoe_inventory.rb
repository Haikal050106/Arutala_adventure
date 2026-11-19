class ShoeInventory < ApplicationRecord
  belongs_to :product
  has_many :product_photos, -> { order(:position, :id) }, dependent: :destroy
  has_many :order_items, dependent: :restrict_with_error
  has_many :rental_items, dependent: :restrict_with_error

  before_validation :normalize_option_values

  validates :name, presence: true, length: { maximum: 100 }
  validates :design_name, presence: true, length: { maximum: 100 }
  validates :color, length: { maximum: 60 }
  validates :size, length: { maximum: 40 }
  validates :capacity, length: { maximum: 40 }
  validates :sale_price, :rent_price_per_day, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :sale_stock, :rental_stock, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :image_url, length: { maximum: 2048 }, allow_blank: true
  validates :image_alt, length: { maximum: 255 }, allow_blank: true
  validates :name, uniqueness: {
    scope: %i[product_id design_name color size capacity],
    message: "dan kombinasi desain serta atribut ini sudah ada."
  }
  validates :active, inclusion: { in: [ true, false ] }
  validate :options_must_be_an_object
  validate :must_be_valid_shoe_inventory

  before_destroy :prevent_destroy_when_used

  def used_in_transaction?
    order_items.exists? || rental_items.exists?
  end

  def primary_photo
    product_photos.find_by(is_primary: true) || product_photos.first
  end

  def display_label
    [ name, design_name, color.presence, size.presence, capacity.presence ].compact.join(" · ")
  end

  private

  def normalize_option_values
    self.color = color.to_s.strip
    self.size = size.to_s.strip
    self.capacity = capacity.to_s.strip
    self.options = {} unless options.is_a?(Hash)
  end

  def options_must_be_an_object
    errors.add(:options, "harus berupa objek.") unless options.is_a?(Hash)
  end

  def must_be_valid_shoe_inventory
    if product&.shoe?
      errors.add(:size, "harus antara 38 sampai 43.") unless Product::SHOE_SIZES.include?(size)
    else
      errors.add(:product, "inventori hanya dapat digunakan untuk sepatu.")
    end
  end

  def prevent_destroy_when_used
    return unless used_in_transaction?

    errors.add(:base, "Inventori sepatu yang sudah digunakan pada transaksi tidak dapat dihapus.")
    throw(:abort)
  end
end
