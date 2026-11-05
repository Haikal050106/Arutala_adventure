module Api
  module V1
    class UsersController < BaseController
      before_action :require_admin!
      before_action :set_user, only: %i[show update destroy]

      def index
        render json: User.order(:name).map { |user| serialize_user(user) }
      end

      def show
        render json: serialize_user(@user)
      end

      def create
        user = User.new(user_params)
        if user.save
          render json: serialize_user(user), status: :created
        else
          render_validation_errors(user)
        end
      end

      def update
        if @user.id == current_user.id && user_params.key?(:role)
          return render_error("role_change_forbidden", "Role akun yang sedang digunakan tidak dapat diubah.", :forbidden)
        end

        if @user.update(user_params)
          @user.auth_sessions.update_all(revoked_at: Time.current, updated_at: Time.current) if user_params[:password].present?
          render json: serialize_user(@user)
        else
          render_validation_errors(@user)
        end
      end

      def destroy
        if @user.id == current_user.id
          return render_error("self_delete_forbidden", "Akun Admin yang sedang digunakan tidak dapat dihapus.", :forbidden)
        end

        @user.destroy!
        head :no_content
      end

      private

      def set_user
        @user = User.find(params[:id])
      end

      def user_params
        params.require(:user).permit(:name, :email, :password, :password_confirmation, :role)
      end

      def serialize_user(user)
        user.as_json(only: %i[id name email role created_at updated_at])
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data pengguna tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
