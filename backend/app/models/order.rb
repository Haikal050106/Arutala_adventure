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

      normalized_items = normalize_purchase_items(items)
      products, variants = lock_purchase_inventory(normalized_items)
      check_purchase_stock!(normalized_items, products, variants, include_pending: false)
      order = new(customer: customer, notes: notes)
      build_purchase_items!(order, normalized_items, products, variants)
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

      normalized_items = normalize_purchase_items(items)
      products, variants = lock_purchase_inventory(normalized_items)
      check_purchase_stock!(normalized_items, products, variants, include_pending: true)
      purchase = new(customer: customer, notes: notes, idempotency_key: idempotency_key)
      build_purchase_items!(purchase, normalized_items, products, variants)
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
    adjusted_inventory_keys = []
    order_items.includes(:product, :product_variant).each do |item|
      inventory = item.product_variant || item.product
      name = item.product_variant&.display_label || item.product.name
      inventory_key = [ item.product_variant_id, item.product_id ]
      item_scope = order_items.where(product_variant_id: item.product_variant_id)
      item_scope = item_scope.where(product_id: item.product_id) unless item.product_variant_id
      quantity = item_scope.sum(:quantity)
      next if adjusted_inventory_keys.include?(inventory_key)

      adjusted_inventory_keys << inventory_key
      stock_column = "sale_stock"
      stock_scope = inventory.class.where(id: inventory.id)
      stock_scope = stock_scope.where("#{stock_column} >= ?", quantity) if direction.negative?
      adjustment = direction.negative? ?
        [ "#{stock_column} = #{stock_column} - ?, updated_at = CURRENT_TIMESTAMP", quantity ] :
        [ "#{stock_column} = #{stock_column} + ?, updated_at = CURRENT_TIMESTAMP", quantity ]
      raise InsufficientStock, name unless stock_scope.update_all(adjustment) == 1
    end
  end

  def self.normalize_purchase_items(items)
    raise ArgumentError, "Minimal satu item pesanan wajib disertakan." unless items.is_a?(Array) && items.any?

    items.map do |item|
      attributes = item.to_h.symbolize_keys
      product_id = send(:positive_integer, attributes.fetch(:product_id))
      quantity = send(:positive_integer, attributes.fetch(:quantity))
      variant_id = attributes[:variant_id].present? ? send(:positive_integer, attributes[:variant_id]) : nil
      { product_id: product_id, variant_id: variant_id, quantity: quantity }
    rescue KeyError, ArgumentError, TypeError
      raise ArgumentError, "Item pesanan memerlukan product_id, jumlah positif, dan variant_id untuk produk bervarian."
    end
  end

  def self.lock_purchase_inventory(items)
    product_ids = items.map { |item| item.fetch(:product_id) }.uniq
    products = Product.where(id: product_ids).order(:id).lock.index_by(&:id)
    raise ActiveRecord::RecordNotFound if products.length != product_ids.length

    variant_ids = items.filter_map { |item| item[:variant_id] }.uniq
    variants = ProductVariant.where(id: variant_ids).order(:id).lock.index_by(&:id)
    raise ActiveRecord::RecordNotFound if variants.length != variant_ids.length
    items.each do |item|
      product = products.fetch(item.fetch(:product_id))
      variant = variants[item[:variant_id]]
      if variant
        raise ArgumentError, "Varian tidak termasuk produk yang dipilih." unless variant.product_id == product.id && variant.active?
      elsif product.product_variants.exists?
        raise ArgumentError, "Pilih varian untuk produk ini."
      end
    end
    [ products, variants ]
  end

  def self.check_purchase_stock!(items, products, variants, include_pending:)
    items.group_by { |item| [ item[:product_id], item[:variant_id] ] }.each do |(product_id, variant_id), grouped_items|
      product = products.fetch(product_id)
      inventory = variants[variant_id] || product
      quantity = grouped_items.sum { |item| item.fetch(:quantity) }
      if include_pending
        pending_scope = self.joins(:order_items).where(status: "pending_confirmation")
        pending_scope = if variant_id
          pending_scope.where(order_items: { product_variant_id: variant_id })
        else
          pending_scope.where(order_items: { product_id: product_id, product_variant_id: nil })
        end
        quantity += pending_scope.sum("order_items.quantity")
      end
      raise InsufficientStock, (variants[variant_id]&.display_label || product.name) if quantity > inventory.sale_stock
    end
  end

  def self.build_purchase_items!(order, items, products, variants)
    items.each do |attributes|
      product = products.fetch(attributes.fetch(:product_id))
      variant = variants[attributes[:variant_id]]
      unit_price = variant&.sale_price || product.sale_price
      order.order_items.build(
        product: product,
        product_variant: variant,
        variant_name: variant&.name,
        variant_design_name: variant&.design_name,
        variant_color: variant&.color,
        variant_size: variant&.size,
        variant_options: variant ? variant.options.merge("capacity" => variant.capacity).compact_blank : {},
        quantity: attributes.fetch(:quantity),
        unit_price: unit_price,
        subtotal: unit_price * attributes.fetch(:quantity)
      )
    end
    order.total_amount = order.order_items.sum(&:subtotal)
  end
end
