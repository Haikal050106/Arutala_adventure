class Order < ApplicationRecord
  STATUSES = %w[pending_confirmation confirmed processing completed cancelled].freeze
  STATUS_TRANSITIONS = {
    "pending_confirmation" => %w[confirmed cancelled],
    "confirmed" => %w[processing cancelled],
    "processing" => %w[completed],
    "completed" => [],
    "cancelled" => []
  }.freeze

  class InsufficientStock < StandardError
    attr_reader :product_name

    def initialize(product_name)
      @product_name = product_name
      super("#{product_name}: stok jual tidak mencukupi.")
    end
  end

  class CustomerCancellationNotAllowed < StandardError
    attr_reader :status

    def initialize(status)
      @status = status
      super("Pesanan dengan status #{status} tidak dapat dibatalkan.")
    end
  end

  belongs_to :customer
  has_many :order_items, dependent: :destroy
  has_many :payments, dependent: :restrict_with_error

  before_validation :assign_order_number, on: :create

  validates :order_number, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :total_amount, numericality: { greater_than_or_equal_to: 0 }
  validates :idempotency_key, length: { maximum: 100 }, allow_nil: true

  def self.create_purchase!(customer:, notes:, items:)
    transaction do
      raise ArgumentError, "Minimal satu item pesanan wajib disertakan." unless items.is_a?(Array) && items.any?

      normalized_items = items.map do |item|
        attributes = item.to_h.symbolize_keys
        product_id = Integer(attributes.fetch(:product_id))
        quantity = Integer(attributes.fetch(:quantity))
        raise ArgumentError, "Jumlah produk harus lebih dari nol." unless quantity.positive?

        { product_id: product_id, quantity: quantity }
      rescue KeyError, ArgumentError, TypeError
        raise ArgumentError, "Item pesanan memerlukan product_id dan jumlah positif."
      end
      products = Product.where(id: normalized_items.map { |item| item.fetch(:product_id) }.uniq)
        .order(:id).lock.index_by(&:id)
      raise ActiveRecord::RecordNotFound if products.length != normalized_items.map { |item| item.fetch(:product_id) }.uniq.length

      normalized_items.group_by { |item| item.fetch(:product_id) }.each do |product_id, product_items|
        product = products.fetch(product_id)
        quantity = product_items.sum { |item| item.fetch(:quantity) }
        raise InsufficientStock, product.name if quantity > product.sale_stock
      end

      order = new(customer: customer, notes: notes)
      normalized_items.each do |attributes|
        product = products.fetch(attributes.fetch(:product_id))
        order.order_items.build(
          product: product,
          quantity: attributes.fetch(:quantity),
          unit_price: product.sale_price,
          subtotal: product.sale_price * attributes.fetch(:quantity)
        )
      end
      order.total_amount = order.order_items.sum(&:subtotal)
      order.save!
      order
    end
  end

  def self.create_customer_purchase!(customer:, notes:, items:, idempotency_key:)
    existing_order = customer.orders.find_by(idempotency_key: idempotency_key)
    return [ existing_order, false ] if existing_order

    created = false
    order = transaction do
      existing_order = customer.orders.find_by(idempotency_key: idempotency_key)
      next existing_order if existing_order

      raise ArgumentError, "Minimal satu item pesanan wajib disertakan." unless items.is_a?(Array) && items.any?

      normalized_items = items.map do |item|
        attributes = item.to_h.symbolize_keys
        product_id = positive_integer(attributes.fetch(:product_id))
        quantity = positive_integer(attributes.fetch(:quantity))
        { product_id: product_id, quantity: quantity }
      rescue KeyError, ArgumentError, TypeError
        raise ArgumentError, "Item pesanan memerlukan product_id dan jumlah positif."
      end
      products = Product.where(id: normalized_items.map { |item| item.fetch(:product_id) }.uniq)
        .order(:id).lock.index_by(&:id)
      raise ActiveRecord::RecordNotFound if products.length != normalized_items.map { |item| item.fetch(:product_id) }.uniq.length

      normalized_items.group_by { |item| item.fetch(:product_id) }.each do |product_id, product_items|
        product = products.fetch(product_id)
        quantity = product_items.sum { |item| item.fetch(:quantity) }
        reserved_quantity = joins(:order_items)
          .where(status: "pending_confirmation", order_items: { product_id: product_id })
          .sum("order_items.quantity")
        raise InsufficientStock, product.name if quantity + reserved_quantity > product.sale_stock
      end

      purchase = new(customer: customer, notes: notes, idempotency_key: idempotency_key)
      normalized_items.each do |attributes|
        product = products.fetch(attributes.fetch(:product_id))
        purchase.order_items.build(
          product: product,
          quantity: attributes.fetch(:quantity),
          unit_price: product.sale_price,
          subtotal: product.sale_price * attributes.fetch(:quantity)
        )
      end
      purchase.total_amount = purchase.order_items.sum(&:subtotal)
      purchase.save!
      created = true
      purchase
    end

    [ order, created ]
  rescue ActiveRecord::RecordNotUnique
    existing_order = customer.orders.find_by(idempotency_key: idempotency_key)
    raise unless existing_order

    [ existing_order, false ]
  end

  def transition_to!(target_status)
    with_lock do
      apply_transition!(target_status)
    end
  end

  def cancel_by_customer!
    with_lock do
      unless STATUS_TRANSITIONS.fetch(status, []).include?("cancelled")
        raise CustomerCancellationNotAllowed, status
      end

      apply_transition!("cancelled")
    end
  end

  private

  def apply_transition!(target_status)
    unless STATUS_TRANSITIONS.fetch(status, []).include?(target_status)
      errors.add(:status, "tidak dapat diubah dari #{status} menjadi #{target_status}.")
      raise ActiveRecord::RecordInvalid, self
    end

    if target_status == "cancelled"
      pending_payments = payments.where(status: "pending")
      if pending_payments.where.not(method: "qris").exists? || payments.where(status: "succeeded").exists?
        raise Payment::TransactionNotCancellable
      end
      pending_payments.where(method: "qris").update_all(status: "failed", updated_at: Time.current)
    elsif target_status == "completed" &&
        Payment.summary_for(total_amount, payments.reload).fetch(:payment_status) != "paid"
      errors.add(:status, "tidak dapat diselesaikan sebelum pembayaran lunas.")
      raise ActiveRecord::RecordInvalid, self
    end

    if target_status == "confirmed"
      adjust_product_stock!(-1)
      self.stock_deducted = true
    elsif target_status == "cancelled" && stock_deducted?
      adjust_product_stock!(1)
      self.stock_deducted = false
    end

    update!(status: target_status, stock_deducted: stock_deducted)
  end

  def self.positive_integer(value)
    raise ArgumentError unless value.to_s.match?(/\A[1-9]\d*\z/)

    Integer(value)
  end

  def assign_order_number
    self.order_number ||= "AA-#{Time.current.strftime('%y%m%d')}-#{SecureRandom.hex(4).upcase}"
  end

  def adjust_product_stock!(direction)
    order_items.includes(:product).order(:product_id).each do |item|
      product = item.product
      quantity = item.quantity
      stock_scope = Product.where(id: product.id)
      stock_scope = stock_scope.where("sale_stock >= ?", quantity) if direction.negative?
      adjustment = if direction.negative?
        [ "sale_stock = sale_stock - ?, updated_at = CURRENT_TIMESTAMP", quantity ]
      else
        [ "sale_stock = sale_stock + ?, updated_at = CURRENT_TIMESTAMP", quantity ]
      end
      raise InsufficientStock, product.name unless stock_scope.update_all(adjustment) == 1
    end
  end
end
