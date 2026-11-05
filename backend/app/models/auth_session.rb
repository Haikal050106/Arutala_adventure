class AuthSession < ApplicationRecord
  TOKEN_TTL = 12.hours

  belongs_to :user

  validates :token_digest, presence: true, uniqueness: true
  validates :expires_at, presence: true

  def self.issue_for(user)
    raw_token = SecureRandom.urlsafe_base64(32)
    session = create!(
      user: user,
      token_digest: digest(raw_token),
      expires_at: TOKEN_TTL.from_now
    )
    [ session, raw_token ]
  end

  def self.authenticate(raw_token)
    return if raw_token.blank?

    session = includes(:user).find_by(token_digest: digest(raw_token))
    return unless session && session.revoked_at.nil? && session.expires_at.future?

    session
  end

  def self.digest(raw_token)
    Digest::SHA256.hexdigest(raw_token)
  end
end
