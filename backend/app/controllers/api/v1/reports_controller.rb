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

        purchase_payments, rental_payments = successful_payment_scopes(date_range)
        purchase_revenue = purchase_payments.sum(:amount)
        rental_revenue = rental_payments.sum(:amount)
        chart = revenue_chart(purchase_payments, rental_payments, period)

        render json: {
          reporting_start_at: ReportingWindow::RESET_AT.iso8601(3),
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

      def transactions
        parse_date_range(default_start_date: ReportingWindow::RESET_AT.to_date)
        return if performed?

        orders = Order.includes(:customer).where(created_at: date_range).order(created_at: :desc)
        rentals = Rental.includes(:customer).where(created_at: date_range).order(created_at: :desc)
        purchase_payments, rental_payments = successful_payment_scopes(date_range)
        purchase_revenue_by_order = purchase_payments.group(:order_id).sum(:amount)
        rental_revenue_by_rental = rental_payments.group(:rental_id).sum(:amount)
        purchase_revenue = purchase_revenue_by_order.values.sum
        rental_revenue = rental_revenue_by_rental.values.sum

        transactions = orders.map do |order|
          serialize_report_transaction(order, "purchase", order.order_number, purchase_revenue_by_order)
        end
        transactions.concat(rentals.map do |rental|
          serialize_report_transaction(rental, "rental", rental.rental_number, rental_revenue_by_rental)
        end)

        render json: {
          reporting_start_at: ReportingWindow::RESET_AT.iso8601(3),
          filters: { start_date: @start_date, end_date: @end_date },
          summary: {
            transactions: { purchases: orders.length, rentals: rentals.length },
            revenue: {
              total: purchase_revenue + rental_revenue,
              purchase: purchase_revenue,
              rental: rental_revenue
            }
          },
          transactions: transactions.sort_by { |transaction| transaction[:created_at] }.reverse
        }
      end

      private

      def parse_date_range(default_start_date: nil)
        @end_date = parse_date(params[:end_date]) || Date.current
        requested_start_date = parse_date(params[:start_date]) || default_start_date || (@end_date - 29.days)
        if requested_start_date > @end_date
          return render_error("invalid_date_range", "Tanggal mulai tidak boleh setelah tanggal akhir.", :unprocessable_entity)
        end

        @start_date = [ requested_start_date, ReportingWindow::RESET_AT.to_date ].max
      rescue Date::Error
        render_error("invalid_date_range", "Format tanggal harus YYYY-MM-DD.", :unprocessable_entity)
      end

      def parse_date(value)
        return if value.blank?

        Date.iso8601(value)
      end

      def date_range
        [ @start_date.beginning_of_day, ReportingWindow::RESET_AT ].max..@end_date.end_of_day
      end

      def successful_payment_scopes(range)
        succeeded_payments = Payment.where(status: "succeeded", paid_at: range)
        purchase_payments = succeeded_payments.joins(:order).where(orders: { created_at: range })
        rental_payments = succeeded_payments.joins(:rental).where(rentals: { created_at: range })
        [ purchase_payments, rental_payments ]
      end

      def revenue_chart(purchase_payments, rental_payments, period)
        key_sql = period == "monthly" ? "strftime('%Y-%m', paid_at)" : "DATE(paid_at)"
        purchase_grouped = purchase_payments.group(Arel.sql(key_sql)).sum(:amount)
        rental_grouped = rental_payments.group(Arel.sql(key_sql)).sum(:amount)

        chart_buckets(period).map do |date, key|
          purchase = purchase_grouped[key] || 0
          rental = rental_grouped[key] || 0
          { date: date, purchase: purchase, rental: rental, total: purchase + rental }
        end
      end

      def chart_buckets(period)
        return [] if @start_date > @end_date || @end_date.end_of_day < ReportingWindow::RESET_AT

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

      def serialize_report_transaction(transaction, kind, number, revenue_by_transaction)
        {
          id: transaction.id,
          number: number,
          payment_code: transaction.payment_code,
          kind: kind,
          created_at: transaction.created_at,
          customer: { name: transaction.customer.name },
          total_amount: transaction.total_amount,
          status: transaction.status,
          successful_payment_amount: revenue_by_transaction[transaction.id] || 0
        }
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
