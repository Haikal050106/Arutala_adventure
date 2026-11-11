class Product < ApplicationRecord
  belongs_to :category
  has_many :product_photos, -> { order(:position, :id) }, dependent: :destroy

  before_validation :generate_slug, on: :create

  validates :slug, presence: true, uniqueness: true
  validates :name, presence: true, length: { maximum: 100 }
  validates :description, presence: true, length: { maximum: 500 }
  validates :sale_price, :rent_price_per_day, numericality: { greater_than_or_equal_to: 0 }
  validates :sale_stock, :rental_stock, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :image_url, :image_alt, length: { maximum: 255 }, allow_blank: true

  def available?
    sale_stock.positive? || rental_stock.positive?
  end

  def primary_photo
    product_photos.find_by(is_primary: true) || product_photos.first
  end

  private

  def generate_slug
    return if slug.present? || name.blank?

    base_slug = name.parameterize.presence || "product"
    candidate = base_slug
    suffix = 2
    while self.class.exists?(slug: candidate)
      candidate = "#{base_slug}-#{suffix}"
      suffix += 1
    end
    self.slug = candidate
  end
end
