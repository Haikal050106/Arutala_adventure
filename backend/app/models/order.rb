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
  before_validation :assign_payment_code, on: :create

  validates :order_number, presence: true, uniqueness: true
  validates :payment_code, presence: true, uniqueness: true,
    format: { with: /\AARU-\d{8}-\d{4}\z/ }
  validates :status, inclusion: { in: STATUSES }
  validates :total_amount, numericality: { greater_than_or_equal_to: 0 }
  validates :idempotency_key, length: { maximum: 100 }, allow_nil: true

  def self.create_purchase!(customer:, notes:, items:)
    transaction do
      raise ArgumentError, "Minimal satu item pesanan wajib disertakan." unless items.is_a?(Array) && items.any?

      normalized_items = normalize_purchase_items(items)
      products, inventories = lock_purchase_inventory(normalized_items)
      check_purchase_stock!(normalized_items, products, inventories, include_pending: false)
      order = new(customer: customer, notes: notes)
      build_purchase_items!(order, normalized_items, products, inventories)
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
      products, inventories = lock_purchase_inventory(normalized_items)
      check_purchase_stock!(normalized_items, products, inventories, include_pending: true)
      purchase = new(customer: customer, notes: notes, idempotency_key: idempotency_key)
      build_purchase_items!(purchase, normalized_items, products, inventories)
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

  def assign_payment_code
    self.payment_code ||= TransactionCodeSequence.next_code!
  end

  def adjust_product_stock!(direction)
    adjusted_inventory_keys = []
    order_items.includes(:product, :shoe_inventory).each do |item|
    inventory = item.shoe_inventory || item.product
    name = item.shoe_inventory&.display_label || item.product.name
    inventory_key = [ item.shoe_inventory_id, item.product_id ]
    item_scope = order_items.where(shoe_inventory_id: item.shoe_inventory_id)
    item_scope = item_scope.where(product_id: item.product_id) unless item.shoe_inventory_id
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
      shoe_inventory_id = attributes[:shoe_inventory_id].present? ? send(:positive_integer, attributes[:shoe_inventory_id]) : nil
      size = attributes[:size].present? ? attributes[:size].to_s.strip : nil
      raise ArgumentError, "Ukuran sepatu harus antara 38 sampai 43." if size && !Product::SHOE_SIZES.include?(size)
      { product_id: product_id, shoe_inventory_id: shoe_inventory_id, size: size, quantity: quantity }
    rescue KeyError, ArgumentError, TypeError
      raise ArgumentError, "Item pesanan memerlukan product_id dan jumlah positif."
    end
  end

  def self.lock_purchase_inventory(items)
    product_ids = items.map { |item| item.fetch(:product_id) }.uniq
    products = Product.where(id: product_ids).order(:id).lock.index_by(&:id)
    raise ActiveRecord::RecordNotFound if products.length != product_ids.length

    inventory_ids = items.filter_map { |item| item[:shoe_inventory_id] }.uniq
    size_product_ids = items.filter_map { |item| item[:product_id] if item[:size].present? }.uniq
    size_values = items.filter_map { |item| item[:size] }.uniq
    inventories_scope = ShoeInventory.where(id: inventory_ids)
    if size_product_ids.any?
      inventories_scope = inventories_scope.or(
        ShoeInventory.where(product_id: size_product_ids, active: true, size: size_values)
      )
    end
    inventories = inventories_scope.order(:id).lock.index_by(&:id)
    raise ActiveRecord::RecordNotFound if inventory_ids.any? && inventories.length < inventory_ids.length
    items.each do |item|
      product = products.fetch(item.fetch(:product_id))
      inventory = inventories[item[:shoe_inventory_id]]
      if product.shoe?
        raise ArgumentError, "Pilih ukuran sepatu yang tersedia." unless item[:size].present?
        raise ArgumentError, "Pilih ukuran sepatu, bukan inventori fisik." if item[:shoe_inventory_id]
        item[:shoe_inventory_ids] = inventories.values.select do |shoe_inventory|
          shoe_inventory.product_id == product.id && shoe_inventory.active? && shoe_inventory.size == item[:size]
        end.map(&:id)
        raise ArgumentError, "Ukuran sepatu #{item[:size]} tidak tersedia." if item[:shoe_inventory_ids].empty?
      elsif item[:size].present? || item[:shoe_inventory_id]
        raise ArgumentError, "Ukuran dan inventori sepatu hanya berlaku untuk sepatu."
      end
      if inventory
        raise ArgumentError, "Inventori tidak termasuk produk yang dipilih." unless inventory.product_id == product.id && inventory.active?
      end
    end
    [ products, inventories ]
  end

  def self.check_purchase_stock!(items, products, inventories, include_pending:)
    items.group_by { |item| [ item[:product_id], item[:size], item[:shoe_inventory_id] ] }.each do |(product_id, size, shoe_inventory_id), grouped_items|
      product = products.fetch(product_id)
      inventory = inventories[shoe_inventory_id] || product
      quantity = grouped_items.sum { |item| item.fetch(:quantity) }
      if include_pending
        pending_scope = self.joins(:order_items).where(status: "pending_confirmation")
          .where(order_items: { product_id: product_id })
        pending_scope = if size
          pending_scope.where(order_items: { inventory_size: size })
        elsif shoe_inventory_id
          pending_scope.where(order_items: { shoe_inventory_id: shoe_inventory_id })
        else
          pending_scope.where(order_items: { shoe_inventory_id: nil })
        end
        quantity += pending_scope.sum("order_items.quantity")
      end
      stock = if product.shoe? && size
        inventories.values.select { |candidate| candidate.product_id == product.id && candidate.active? && candidate.size == size }.sum(&:sale_stock)
      else
        inventory.sale_stock
      end
      raise InsufficientStock, (product.shoe? ? "#{product.name} ukuran #{size}" : product.name) if quantity > stock
    end
  end

  def self.build_purchase_items!(order, items, products, inventories)
    items.each do |attributes|
      product = products.fetch(attributes.fetch(:product_id))
      unit_price = product.sale_price
      if product.shoe? && attributes[:size]
        quantity_left = attributes.fetch(:quantity)
        inventory_ids = attributes.fetch(:shoe_inventory_ids)
        inventory_ids.each do |inventory_id|
          inventory = inventories.fetch(inventory_id)
          pending_quantity = Order.joins(:order_items).where(status: "pending_confirmation")
            .where(order_items: { shoe_inventory_id: inventory.id }).sum("order_items.quantity")
          allocated = [ [ inventory.sale_stock - pending_quantity, 0 ].max, quantity_left ].min
          next unless allocated.positive?

          order.order_items.build(
            product: product,
            shoe_inventory: inventory,
            inventory_model_name: inventory.name,
            inventory_design_name: inventory.design_name,
            inventory_color: inventory.color,
            inventory_size: inventory.size,
            inventory_attributes: inventory.options.merge("capacity" => inventory.capacity).compact_blank,
            quantity: allocated,
            unit_price: unit_price,
            subtotal: unit_price * allocated
          )
          quantity_left -= allocated
          break if quantity_left.zero?
        end
        raise InsufficientStock, "#{product.name} ukuran #{attributes[:size]}" if quantity_left.positive?
      else
        order.order_items.build(
          product: product,
          quantity: attributes.fetch(:quantity),
          unit_price: unit_price,
          subtotal: unit_price * attributes.fetch(:quantity)
        )
      end
    end
    order.total_amount = order.order_items.sum(&:subtotal)
  end
end
