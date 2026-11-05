module Api
  module V1
    class CustomersController < BaseController
      before_action :require_staff!
      before_action :require_admin!, only: %i[update destroy]
      before_action :set_customer, only: %i[show update destroy]

      def index
        render json: Customer.order(:name).map { |customer| serialize_customer(customer) }
      end

      def show
        render json: serialize_customer(@customer)
      end

      def create
        attributes = customer_params
        customer = Customer.find_by_phone(attributes[:phone]) || Customer.new(attributes)
        return render json: serialize_customer(customer), status: :ok if customer.persisted?

        if customer.save
          render json: serialize_customer(customer), status: :created
        else
          render_validation_errors(customer)
        end
      end

      def update
        if @customer.update(customer_params)
          render json: serialize_customer(@customer)
        else
          render_validation_errors(@customer)
        end
      end

      def destroy
        if @customer.destroy
          head :no_content
        else
          render_error("customer_has_transactions", "Pelanggan dengan riwayat transaksi tidak dapat dihapus.", :conflict,
            details: @customer.errors.full_messages)
        end
      end

      private

      def set_customer
        @customer = Customer.find(params[:id])
      end

      def customer_params
        params.require(:customer).permit(:name, :email, :phone, :village_name)
      end

      def serialize_customer(customer)
        customer.as_json(only: %i[id name email phone village_name created_at updated_at])
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data pelanggan tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
