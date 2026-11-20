module Api
  module V1
    class AuthController < BaseController
      skip_before_action :authenticate_request!, only: %i[login customer_register customer_login]
      before_action :authenticate_request!, only: %i[me logout update_account]

      def login
        credentials = auth_credentials
        return if performed?

        user = User.find_by(email: credentials[:email])
        unless user&.role.in?(%w[admin cashier]) && user.authenticate(credentials[:password])
          return render_error("invalid_credentials", "Email atau kata sandi tidak valid.", :unauthorized)
        end

        auth_session, raw_token = AuthSession.issue_for(user)
        render_auth_response(user, auth_session, raw_token)
      rescue ActionController::ParameterMissing
        render_invalid_credentials
      end

      def customer_register
        credentials = params.require(:auth).permit(
          :name, :email, :phone, :password, :password_confirmation
        )
        email = credentials[:email].to_s.strip.downcase
        if email.present? && (User.exists?(email: email) || Customer.exists?(email: email))
          return render_email_conflict
        end

        user = nil
        auth_session = nil
        raw_token = nil
        User.transaction do
          customer = Customer.create!(
            name: credentials[:name],
            email: credentials[:email],
            phone: credentials[:phone]
          )
          user = User.create!(
            name: credentials[:name],
            email: credentials[:email],
            password: credentials[:password],
            password_confirmation: credentials[:password_confirmation],
            role: "customer",
            customer: customer
          )
          auth_session, raw_token = AuthSession.issue_for(user)
        end
        render_auth_response(user, auth_session, raw_token, include_customer: true)
      rescue ActiveRecord::RecordInvalid => error
        return render_email_conflict if error.record.errors.of_kind?(:email, :taken)

        render_validation_errors(error.record)
      rescue ActiveRecord::RecordNotUnique
        render_email_conflict
      rescue ActionController::ParameterMissing
        render_error("invalid_registration", "Data pendaftaran wajib disertakan.", :unprocessable_entity)
      end

      def customer_login
        credentials = auth_credentials
        return if performed?

        user = User.includes(:customer).find_by(email: credentials[:email])
        unless user&.role == "customer" && user.customer && user.authenticate(credentials[:password])
          return render_error("invalid_credentials", "Email atau kata sandi tidak valid.", :unauthorized)
        end

        auth_session, raw_token = AuthSession.issue_for(user)
        render_auth_response(user, auth_session, raw_token, include_customer: true)
      rescue ActionController::ParameterMissing
        render_invalid_credentials
      end

      def me
        response = { user: serialize_user(current_user) }
        response[:customer] = serialize_customer(current_user.customer) if current_user.role == "customer"
        render json: response
      end

      def logout
        current_auth_session.update!(revoked_at: Time.current)
        head :no_content
      end

      def update_account
        unless current_user.role == "admin"
          return render_error("forbidden", "Pengaturan akun ini hanya tersedia untuk Admin.", :forbidden)
        end

        account = params.require(:account).permit(
          :email, :current_password, :password, :password_confirmation
        )
        current_password = account[:current_password].to_s
        if current_password.blank?
          return render_error("current_password_required", "Kata sandi saat ini wajib diisi.", :unprocessable_entity)
        end
        unless current_user.authenticate(current_password)
          return render_error("invalid_current_password", "Kata sandi saat ini tidak valid.", :unprocessable_entity)
        end

        password_changed = account[:password].present?
        if account[:email].blank? && !password_changed
          return render_error("account_change_required", "Masukkan email atau kata sandi baru.", :unprocessable_entity)
        end
        if password_changed && account[:password_confirmation].blank?
          return render_error("password_confirmation_required", "Konfirmasi kata sandi baru wajib diisi.", :unprocessable_entity)
        end
        if !password_changed && account[:password_confirmation].present?
          return render_error("invalid_password_confirmation", "Konfirmasi hanya dapat diisi bersama kata sandi baru.", :unprocessable_entity)
        end

        attributes = account.to_h.slice("email", "password", "password_confirmation")
        updated = User.transaction do
          if current_user.update(attributes)
            current_user.auth_sessions.update_all(revoked_at: Time.current, updated_at: Time.current) if password_changed
            true
          else
            false
          end
        end
        unless updated
          return render_validation_errors(current_user, message: "Data akun tidak valid.")
        end

        render json: {
          user: serialize_user(current_user),
          password_changed: password_changed
        }
      rescue ActionController::ParameterMissing
        render_error("invalid_account_update", "Data akun wajib disertakan.", :unprocessable_entity)
      end

      private

      def auth_credentials
        credentials = params.require(:auth).permit(:email, :password)
        email = credentials[:email].to_s.strip.downcase
        password = credentials[:password].to_s
        if email.blank? || password.blank?
          render_invalid_credentials
          return {}
        end

        { email: email, password: password }
      end

      def render_invalid_credentials
        render_error("invalid_credentials", "Email dan kata sandi wajib diisi.", :unprocessable_entity)
      end

      def render_email_conflict
        render_error(
          "email_conflict",
          "Email tidak dapat digunakan untuk pendaftaran. Periksa data atau hubungi toko.",
          :conflict
        )
      end

      def render_validation_errors(record, message: "Data pendaftaran tidak valid.")
        render_error(
          "validation_failed",
          message,
          :unprocessable_entity,
          details: record.errors.full_messages
        )
      end

      def render_auth_response(user, auth_session, raw_token, include_customer: false)
        response = {
          token: raw_token,
          token_type: "Bearer",
          expires_at: auth_session.expires_at,
          user: serialize_user(user)
        }
        response[:customer] = serialize_customer(user.customer) if include_customer
        render json: response, status: :created
      end

      def serialize_user(user)
        user.as_json(only: %i[id name email role])
      end

      def serialize_customer(customer)
        customer.as_json(only: %i[id name email phone village_name])
      end
    end
  end
end
