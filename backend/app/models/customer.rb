class Customer < ApplicationRecord
  has_one :user, dependent: :destroy
  has_many :orders, dependent: :restrict_with_error
  has_many :rentals, dependent: :restrict_with_error

  before_validation :normalize_email
  before_validation :normalize_phone

  validates :name, presence: true, length: { maximum: 100 }
  validates :email, length: { maximum: 150 }, allow_blank: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, uniqueness: { case_sensitive: false }, allow_blank: true
  validates :phone, length: { minimum: 8, maximum: 20 }, allow_blank: true
  validates :phone, format: { with: /\A\+?[0-9][0-9\s()-]{6,18}[0-9]\z/ }, uniqueness: true, allow_blank: true
  validates :village_name, length: { maximum: 150 }, allow_blank: true

  def self.find_by_phone(phone)
    normalized_phone = normalize_phone_number(phone)
    return if normalized_phone.blank?

    find_each.find { |customer| normalize_phone_number(customer.phone) == normalized_phone }
  end

  def self.normalize_phone_number(phone)
    digits = phone.to_s.gsub(/\D/, "")
    digits.sub(/\A62/, "0")
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase.presence
  end

  def normalize_phone
    self.phone = phone.to_s.strip.presence
  end
end
