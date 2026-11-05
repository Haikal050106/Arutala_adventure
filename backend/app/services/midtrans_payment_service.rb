class MidtransPaymentService
  def initialize(gateway: nil)
    @gateway = gateway
  end

  def initiate!(transaction:, idempotency_key:)
    unless idempotency_key.to_s.match?(/\A[a-zA-Z0-9._:-]{1,100}\z/)
      raise Payment::InvalidPayment.new(
        "invalid_idempotency_key",
        "Header Idempotency-Key wajib diisi dengan format yang valid."
      )
    end
    gateway = midtrans_gateway

    payment = transaction.with_lock do
      existing = Payment.find_by(idempotency_key: idempotency_key)
      if existing
        unless belongs_to_transaction?(existing, transaction) && existing.method == "gateway" && existing.provider == "midtrans"
          raise Payment::InvalidPayment.new(
            "idempotency_conflict",
            "Kunci idempotensi sudah digunakan untuk pembayaran yang berbeda.",
            :conflict
          )
        end
        next existing
      end

      if transaction.status == "cancelled"
        raise Payment::InvalidPayment.new("transaction_not_payable", "Transaksi yang dibatalkan tidak dapat menerima pembayaran.", :conflict)
      end
      if transaction.payments.where(method: "qris", status: "pending").exists?
        raise Payment::InvalidPayment.new("qris_payment_pending", "Pembayaran QRIS sedang menunggu verifikasi kasir.", :conflict)
      end

      active_payment = transaction.payments.find_by(
        method: "gateway",
        provider: "midtrans",
        status: "pending"
      )
      next active_payment if active_payment

      paid_amount = transaction.payments.where(status: "succeeded").sum(:amount)
      balance_due = transaction.total_amount - paid_amount
      if balance_due <= 0
        raise Payment::InvalidPayment.new("no_balance_due", "Transaksi ini sudah lunas.", :conflict)
      end
      if !balance_due.frac.zero?
        raise Payment::InvalidPayment.new("invalid_gateway_amount", "Nominal Midtrans harus berupa Rupiah bulat.")
      end

      Payment.create!(
        order: transaction.is_a?(Order) ? transaction : nil,
        rental: transaction.is_a?(Rental) ? transaction : nil,
        amount: balance_due,
        currency: "IDR",
        method: "gateway",
        status: "pending",
        provider: "midtrans",
        idempotency_key: idempotency_key
      )
    end

    payment.with_lock do
      if payment.status != "pending"
        raise Payment::InvalidPayment.new("payment_not_pending", "Checkout ini tidak lagi menunggu pembayaran.", :conflict)
      end

      if payment.checkout_token.blank?
        checkout = gateway.create_snap(payment: payment, customer: transaction.customer)
        payment.update!(checkout_token: checkout.fetch(:token), checkout_url: checkout.fetch(:redirect_url))
      end
    end

    {
      payment: payment.reload,
      snap_token: payment.checkout_token,
      checkout_url: payment.checkout_url,
      client_key: gateway.client_key
    }
  rescue ActiveRecord::RecordNotUnique
    retry_payment = Payment.find_by(idempotency_key: idempotency_key)
    raise unless retry_payment && belongs_to_transaction?(retry_payment, transaction)

    initiate!(transaction: transaction, idempotency_key: idempotency_key)
  end

  def refresh!(payment:)
    payment.with_lock do
      status = midtrans_gateway.status(payment.reference)
      payment.apply_midtrans_status!(status)
      payment
    end
  end

  def process_notification!(notification:)
    payment = Payment.find_by(provider: "midtrans", reference: notification["order_id"])
    unless payment
      Rails.logger.warn("Ignoring signed Midtrans notification for an unknown Payment reference.")
      return :unknown
    end

    refresh!(payment: payment)
    payment
  end

  private

  def belongs_to_transaction?(payment, transaction)
    transaction.is_a?(Order) ? payment.order_id == transaction.id : payment.rental_id == transaction.id
  end

  def midtrans_gateway
    @gateway ||= MidtransGateway.new
  end
end
