class User < ApplicationRecord
  ROLES = %w[admin cashier customer].freeze
  has_secure_password

  belongs_to :customer, optional: true
  has_many :auth_sessions, dependent: :destroy

  before_validation :normalize_email

  validate :customer_role_requires_customer
  validates :name, presence: true, length: { maximum: 100 }
  validates :email, presence: true, length: { maximum: 150 },
    format: { with: URI::MailTo::EMAIL_REGEXP }, uniqueness: { case_sensitive: false }
  validates :password, length: { minimum: 12 }, if: -> { password.present? }
  validate :password_within_bcrypt_limit, if: -> { password.present? }
  validates :role, inclusion: { in: ROLES }

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end

  def password_within_bcrypt_limit
    return if password.bytesize <= 72

    errors.add(:password, "maksimal 72 byte.")
  end

  def customer_role_requires_customer
    return unless role == "customer" && customer.blank?

    errors.add(:customer, "harus terhubung ke profil pelanggan.")
  end
end
