module Api
  module V1
    class ReportsController < BaseController
      before_action :require_staff!

      def dashboard
        parse_date_range
        return if performed?

        period = params[:period].presence || "daily"
        unless %w[daily monthly].include?(period)
          return render_error("invalid_period", "Periode harus daily atau monthly.", :unprocessable_entity)
        end

        payment_scope = Payment.where(status: "succeeded", paid_at: date_range)
        purchase_revenue = payment_scope.where.not(order_id: nil).sum(:amount)
        rental_revenue = payment_scope.where.not(rental_id: nil).sum(:amount)
        chart = revenue_chart(payment_scope, period)

        render json: {
          filters: { start_date: @start_date, end_date: @end_date, period: period },
          revenue: {
            total: purchase_revenue + rental_revenue,
            purchase: purchase_revenue,
            rental: rental_revenue
          },
          transactions: {
            purchases: Order.where(created_at: date_range).count,
            rentals: Rental.where(created_at: date_range).count
          },
          customers: customer_counts,
          revenue_chart: chart,
          top_selling_products: top_products(OrderItem, :order),
          top_rented_products: top_products(RentalItem, :rental),
          pending_orders: pending_orders,
          pending_rentals: pending_rentals
        }
      end

      private

      def parse_date_range
        @end_date = parse_date(params[:end_date]) || Date.current
        @start_date = parse_date(params[:start_date]) || (@end_date - 29.days)
        return if @start_date <= @end_date

        render_error("invalid_date_range", "Tanggal mulai tidak boleh setelah tanggal akhir.", :unprocessable_entity)
      rescue Date::Error
        render_error("invalid_date_range", "Format tanggal harus YYYY-MM-DD.", :unprocessable_entity)
      end

      def parse_date(value)
        return if value.blank?

        Date.iso8601(value)
      end

      def date_range
        @start_date.beginning_of_day..@end_date.end_of_day
      end

      def revenue_chart(payment_scope, period)
        key_sql = period == "monthly" ? "strftime('%Y-%m', paid_at)" : "DATE(paid_at)"
        grouped = payment_scope.group(Arel.sql(key_sql))
          .sum(Arel.sql("CASE WHEN order_id IS NOT NULL THEN amount ELSE 0 END"))
        rental_grouped = payment_scope.group(Arel.sql(key_sql))
          .sum(Arel.sql("CASE WHEN rental_id IS NOT NULL THEN amount ELSE 0 END"))

        chart_buckets(period).map do |date, key|
          purchase = grouped[key] || 0
          rental = rental_grouped[key] || 0
          { date: date, purchase: purchase, rental: rental, total: purchase + rental }
        end
      end

      def chart_buckets(period)
        if period == "monthly"
          month = @start_date.beginning_of_month
          last_month = @end_date.beginning_of_month
          buckets = []
          while month <= last_month
            key = month.strftime("%Y-%m")
            buckets << [ key, key ]
            month = month.next_month
          end
          buckets
        else
          (@start_date..@end_date).map { |date| [ date.iso8601, date.iso8601 ] }
        end
      end

      def customer_counts
        scope = Customer.where(created_at: date_range)
        online_ids = User.where(role: "customer").where.not(customer_id: nil).select(:customer_id)
        online = scope.where(id: online_ids).distinct.count
        offline = scope.where.not(id: online_ids).count
        { online: online, offline: offline, total: online + offline }
      end

      def top_products(item_model, transaction_association)
        transaction_table = transaction_association.to_s.pluralize
        item_model.joins(transaction_association, :product)
          .where(transaction_table => { created_at: date_range })
          .where.not(transaction_table => { status: "cancelled" })
          .group("products.id", "products.name")
          .order(Arel.sql("SUM(#{item_model.table_name}.quantity) DESC"), "products.name ASC")
          .select("products.id AS product_id, products.name AS product_name, SUM(#{item_model.table_name}.quantity) AS total_quantity")
          .limit(5)
          .map do |product|
            {
              product_id: product.product_id,
              name: product.product_name,
              quantity: product.total_quantity.to_i
            }
          end
      end

      def pending_orders
        Order.includes(:customer).where(status: %w[pending_confirmation confirmed], created_at: date_range)
          .order(created_at: :asc).limit(8).map do |order|
          {
            id: order.id,
            number: order.order_number,
            customer: order.customer.name,
            status: order.status,
            total_amount: order.total_amount,
            created_at: order.created_at
          }
        end
      end

      def pending_rentals
        Rental.includes(:customer).where(status: %w[pending_confirmation confirmed], created_at: date_range)
          .order(created_at: :asc).limit(8).map do |rental|
          {
            id: rental.id,
            number: rental.rental_number,
            customer: rental.customer.name,
            status: rental.status,
            total_amount: rental.total_amount,
            created_at: rental.created_at
          }
        end
      end
    end
  end
end
