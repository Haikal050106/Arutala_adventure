module Api
  module V1
    class BaseController < ApplicationController
      before_action :authenticate_request!

      rescue_from ActiveRecord::RecordNotFound do
        render_error("not_found", "Data yang diminta tidak ditemukan.", :not_found)
      end

      attr_reader :current_user, :current_auth_session

      private

      def authenticate_request!
        token = request.authorization.to_s.match(/\ABearer\s+(.+)\z/i)&.captures&.first
        @current_auth_session = AuthSession.authenticate(token)
        @current_user = current_auth_session&.user
        return if current_user

        render_error("unauthorized", "Autentikasi diperlukan atau sesi sudah kedaluwarsa.", :unauthorized)
      end

      def require_admin!
        return if current_user&.role == "admin"

        render_error("forbidden", "Aksi ini hanya dapat dilakukan oleh Admin.", :forbidden)
      end

      def require_staff!
        return if current_user&.role.in?(%w[admin cashier])

        render_error("forbidden", "Aksi ini memerlukan role Admin atau Kasir.", :forbidden)
      end

      def require_customer!
        return if current_user&.role == "customer" && current_user.customer.present?

        render_error("forbidden", "Aksi ini hanya dapat dilakukan oleh pelanggan.", :forbidden)
      end

      def render_error(code, message, status, details: nil)
        error = { code: code, message: message }
        error[:details] = details if details.present?
        render json: { error: error }, status: status
      end
    end
  end
end
