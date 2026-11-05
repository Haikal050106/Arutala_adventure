module Api
  module V1
    class AuthController < BaseController
      skip_before_action :authenticate_request!, only: %i[login customer_register customer_login]
      before_action :authenticate_request!, only: %i[me logout]

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

      def render_validation_errors(record)
        render_error(
          "validation_failed",
          "Data pendaftaran tidak valid.",
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
