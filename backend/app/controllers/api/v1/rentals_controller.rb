module Api
  module V1
    class RentalsController < BaseController
      before_action :require_staff!
      before_action :set_rental, only: %i[show update destroy]

      rescue_from Rental::AvailabilityError do |error|
        render_error("insufficient_rental_stock", error.message, :conflict,
          details: { product: error.product_name })
      end

      def index
        rentals = Rental.includes(:customer, :payments, { rental_items: :product }, status_histories: :changed_by).order(created_at: :desc)
        rentals = rentals.where(customer_id: params[:customer_id]) if params[:customer_id].present?
        rentals = rentals.where(status: params[:status]) if params[:status].present?
        render json: rentals.map { |rental| serialize_rental(rental) }
      end

      def show
        render json: serialize_rental(@rental)
      end

      def create
        rental = Rental.create_booking!(
          customer: Customer.find(rental_params[:customer_id]),
          village_name: rental_params[:village_name],
          notes: rental_params[:notes],
          items: rental_params[:items],
          actor: current_user
        )
        render json: serialize_rental(rental), status: :created
      rescue ArgumentError => error
        render_error("invalid_rental", error.message, :unprocessable_entity)
      rescue KeyError => error
        render_error("invalid_rental", error.message, :unprocessable_entity)
      rescue ActiveRecord::RecordInvalid => error
        render_validation_errors(error.record)
      rescue ActionController::ParameterMissing
        render_error("invalid_rental", "Data penyewaan wajib disertakan.", :unprocessable_entity)
      end

      def update
        Rental.transaction do
          attributes = rental_params.slice(:village_name, :notes)
          @rental.update!(attributes) if attributes.present?
          if rental_params[:status].present?
            return_conditions = rental_params[:return_conditions]
            if return_conditions.is_a?(ActionController::Parameters)
              return_conditions = return_conditions.key?(:rental_item_id) ? [ return_conditions ] : return_conditions.values
            end
            @rental.transition_to!(
              rental_params[:status],
              actor: current_user,
              return_conditions: return_conditions
            )
          end
        end
        render json: serialize_rental(@rental.reload)
      rescue ActiveRecord::RecordInvalid => error
        render_validation_errors(error.record)
      rescue Payment::TransactionNotCancellable => error
        render_error("payment_refund_required", error.message, :conflict)
      rescue ActionController::ParameterMissing
        render_error("invalid_rental", "Data penyewaan wajib disertakan.", :unprocessable_entity)
      end

      def destroy
        unless %w[pending_confirmation cancelled].include?(@rental.status)
          return render_error("rental_not_deletable", "Penyewaan aktif atau selesai tidak dapat dihapus.", :conflict)
        end

        @rental.destroy!
        head :no_content
      end

      private

      def set_rental
        @rental = Rental.includes(:customer, :payments, { rental_items: :product }, status_histories: :changed_by).find(params[:id])
      end

      def rental_params
        params.require(:rental).permit(
          :customer_id, :village_name, :status, :notes,
          items: %i[product_id quantity start_date return_date],
          return_conditions: %i[rental_item_id condition]
        )
      end

      def serialize_rental(rental)
        serialized = rental.as_json(
          only: %i[
            id rental_number customer_id village_name status return_status notes total_amount actual_returned_at stock_deducted created_at updated_at
          ],
          include: {
            customer: { only: %i[id name email phone village_name] },
            rental_items: {
              only: %i[
                id product_id start_date return_date quantity unit_price_per_day rental_days subtotal return_condition
              ],
              include: { product: { only: %i[id slug name] } }
            },
            payments: { only: Payment::SERIALIZED_FIELDS }
          }
        )
        serialized.merge!(Payment.summary_for(rental.total_amount, rental.payments))
        serialized["display_status"] = rental.display_status
        serialized["status_histories"] = rental.status_histories.sort_by { |history| [ history.created_at, history.id ] }.map do |history|
          {
            id: history.id,
            from_status: history.from_status,
            to_status: history.to_status,
            created_at: history.created_at,
            changed_by: history.changed_by&.name
          }
        end
        serialized
      end

      def render_validation_errors(record)
        render_error("validation_failed", "Data penyewaan tidak valid.", :unprocessable_entity,
          details: record.errors.full_messages)
      end
    end
  end
end
