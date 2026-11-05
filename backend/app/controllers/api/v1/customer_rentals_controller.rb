module Api
  module V1
    class CustomerRentalsController < BaseController
      before_action :require_customer!

      rescue_from Rental::AvailabilityError do |error|
        render_error("insufficient_rental_stock", error.message, :conflict,
          details: { product: error.product_name })
      end

      def index
        rentals = current_user.customer.rentals.includes(
          :customer, :payments, { rental_items: :product }, status_histories: :changed_by
        ).order(created_at: :desc)
        render json: rentals.map { |rental| serialize_rental(rental) }
      end

      def show
        rental = current_user.customer.rentals.includes(
          :customer, :payments, { rental_items: :product }, status_histories: :changed_by
        ).find(params[:id])
        render json: serialize_rental(rental)
      end

      def create
        idempotency_key = request.headers["Idempotency-Key"].to_s
        unless idempotency_key.match?(/\A[a-zA-Z0-9._:-]{1,100}\z/)
          return render_error("invalid_idempotency_key", "Header Idempotency-Key wajib diisi dengan format yang valid.", :unprocessable_entity)
        end

        attributes = params.require(:rental).permit(
          :village_name, :notes, items: %i[product_id quantity start_date return_date]
        )
        rental = Rental.create_customer_booking!(
          customer: current_user.customer,
          village_name: attributes[:village_name],
          notes: attributes[:notes],
          items: attributes[:items],
          idempotency_key: idempotency_key
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

      private

      def serialize_rental(rental)
        serialized = rental.as_json(
          only: %i[
            id rental_number customer_id village_name status return_status notes total_amount stock_deducted created_at updated_at
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
