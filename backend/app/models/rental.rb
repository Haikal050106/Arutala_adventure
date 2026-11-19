class Rental < ApplicationRecord
  SHOE_SIZES = %w[38 39 40 41 42 43].freeze
  STATUSES = %w[pending_confirmation confirmed active returned rejected cancelled].freeze
  RETURN_CONDITIONS = %w[good damaged lost].freeze
  STATUS_TRANSITIONS = {
    "pending_confirmation" => %w[confirmed rejected cancelled],
    "confirmed" => %w[active cancelled],
    "active" => %w[returned],
    "returned" => [],
    "rejected" => [],
    "cancelled" => []
  }.freeze
  attr_accessor :status_change_actor

  class AvailabilityError < StandardError
    attr_reader :product_name

    def initialize(product_name)
      @product_name = product_name
      super("#{product_name}: stok sewa tidak mencukupi pada tanggal yang dipilih.")
    end
  end

  belongs_to :customer
  has_many :rental_items, dependent: :destroy
  has_many :status_histories, class_name: "RentalStatusHistory", dependent: :destroy
  has_many :payments, dependent: :restrict_with_error

  before_validation :assign_rental_number, on: :create
  before_validation :assign_payment_code, on: :create
  before_validation :sync_return_status
  after_create :record_initial_status

  validates :rental_number, presence: true, uniqueness: true
  validates :payment_code, presence: true, uniqueness: true,
    format: { with: /\AARU-\d{8}-\d{4}\z/ }
  validates :village_name, presence: true, length: { maximum: 150 }
  validates :status, inclusion: { in: STATUSES }
  validates :return_status, inclusion: { in: %w[not_returned returned not_applicable] }
  validates :total_amount, numericality: { greater_than_or_equal_to: 0 }
  validates :idempotency_key, length: { maximum: 100 }, allow_nil: true

  def self.create_booking!(customer:, village_name:, notes:, items:, idempotency_key: nil, actor: nil)
    transaction do
      normalized_items = normalize_items(items)
      product_ids = normalized_items.map { |item| item.fetch(:product_id) }.uniq
      product_scope = Product.where(id: product_ids)
      # SQLite ignores row-level FOR UPDATE; this no-op write serializes bookings before availability is read.
      product_scope.update_all("rental_stock = rental_stock")
      products = product_scope
        .order(:id).lock.index_by(&:id)
      raise ActiveRecord::RecordNotFound if products.length != normalized_items.map { |item| item.fetch(:product_id) }.uniq.length
      inventory_ids = normalized_items.filter_map { |item| item[:shoe_inventory_id] }.uniq
      inventory_scope = ShoeInventory.where(id: inventory_ids)
      size_product_ids = normalized_items.filter_map { |item| item[:product_id] if item[:size].present? }.uniq
      if size_product_ids.any?
        inventory_scope = inventory_scope.or(
          ShoeInventory.where(product_id: size_product_ids, active: true, size: normalized_items.filter_map { |item| item[:size] }.uniq)
        )
      end
      inventory_scope.update_all("rental_stock = rental_stock")
      inventories = inventory_scope.order(:id).lock.index_by(&:id)
      raise ActiveRecord::RecordNotFound if inventory_ids.any? && inventories.length < inventory_ids.length
      normalized_items.each do |item|
        product = products.fetch(item.fetch(:product_id))
        if product.shoe?
          raise ArgumentError, "Pilih ukuran sepatu yang tersedia." if item[:size].blank? && item[:shoe_inventory_id].blank?
          item[:size] ||= inventories[item[:shoe_inventory_id]]&.size
          raise ArgumentError, "Pilih inventori sepatu dengan ukuran yang valid." unless SHOE_SIZES.include?(item[:size])
          raise ArgumentError, "Pelanggan hanya dapat memilih ukuran sepatu." if item[:size].present? && item[:shoe_inventory_id].blank? && item[:customer_supplied_shoe_inventory_id]
        elsif item[:size].present? || item[:shoe_inventory_id]
          raise ArgumentError, "Ukuran dan inventori sepatu hanya berlaku untuk sepatu."
        end
        inventory = inventories[item[:shoe_inventory_id]]
        if inventory
          unless product.shoe? && inventory.product_id == product.id && inventory.active? && inventory.size == item[:size]
            raise ArgumentError, "Inventori sepatu aktif harus termasuk produk dan ukuran yang dipilih."
          end
        end
      end

      check_availability!(normalized_items, products, inventories)

      rental = new(customer: customer, village_name: village_name, notes: notes, idempotency_key: idempotency_key)
      rental.status_change_actor = actor
      normalized_items.each do |attributes|
        product = products.fetch(attributes.fetch(:product_id))
        inventory = inventories[attributes[:shoe_inventory_id]]
        unit_price = product.rent_price_per_day
        rental.rental_items.build(
          product: product,
          shoe_inventory: inventory,
          inventory_model_name: inventory&.name,
          inventory_design_name: inventory&.design_name,
          inventory_color: inventory&.color,
          inventory_size: attributes[:size] || inventory&.size,
          inventory_attributes: inventory ? inventory.options.merge("capacity" => inventory.capacity).compact_blank : {},
          start_date: attributes.fetch(:start_date),
          return_date: attributes.fetch(:return_date),
          quantity: attributes.fetch(:quantity),
          unit_price_per_day: unit_price,
          rental_days: (attributes.fetch(:return_date) - attributes.fetch(:start_date)).to_i,
          subtotal: unit_price * attributes.fetch(:quantity) *
            (attributes.fetch(:return_date) - attributes.fetch(:start_date)).to_i
        )
      end
      rental.total_amount = rental.rental_items.sum(&:subtotal)
      rental.save!
      rental
    end
  end

  def self.create_customer_booking!(customer:, village_name:, notes:, items:, idempotency_key:)
    customer.with_lock do
      existing_rental = customer.rentals.find_by(idempotency_key: idempotency_key)
      next existing_rental if existing_rental

      normalized_items = normalize_items(items)
      if normalized_items.any? { |item| item.fetch(:start_date) < Date.current }
        raise ArgumentError, "Tanggal mulai sewa tidak boleh sebelum hari ini."
      end

      create_booking!(
        customer: customer,
        village_name: village_name,
        notes: notes,
        items: normalized_items,
        idempotency_key: idempotency_key
      )
    end
  rescue ActiveRecord::RecordNotUnique
    existing_rental = customer.rentals.find_by(idempotency_key: idempotency_key)
    raise unless existing_rental

    existing_rental
  end

  def transition_to!(target_status, actor: nil, return_conditions: nil, shoe_inventory_assignments: nil)
    with_lock do
      unless STATUS_TRANSITIONS.fetch(status, []).include?(target_status)
        errors.add(:status, "tidak dapat diubah dari #{status} menjadi #{target_status}.")
        raise ActiveRecord::RecordInvalid, self
      end

      if target_status == "cancelled" && payments.where(status: %w[pending succeeded]).exists?
        raise Payment::TransactionNotCancellable
      end
      if target_status == "active" && Payment.summary_for(total_amount, payments)[:payment_status] != "paid"
        errors.add(:status, "penyewaan harus lunas sebelum barang diserahkan.")
        raise ActiveRecord::RecordInvalid, self
      end

      if target_status == "confirmed"
        assign_shoe_inventories!(shoe_inventory_assignments)
        self.class.check_confirmation_availability!(self)
      end

      previous_status = status
      record_return_conditions!(return_conditions) if target_status == "returned"
      adjust_stock_for_transition!(target_status)
      update!(
        status: target_status,
        return_status: target_status == "returned" ? "returned" : (target_status.in?(%w[cancelled rejected]) ? "not_applicable" : "not_returned"),
        actual_returned_at: target_status == "returned" ? Time.current : actual_returned_at,
        stock_deducted: target_status == "active" ? true : (target_status.in?(%w[cancelled rejected returned]) ? false : stock_deducted?)
      )
      status_histories.create!(
        from_status: previous_status,
        to_status: target_status,
        changed_by: actor
      )
    end
  end

  def display_status
    case status
    when "pending_confirmation" then "Menunggu Konfirmasi"
    when "confirmed"
      Payment.summary_for(total_amount, payments)[:payment_status] == "paid" ? "Dibayar" : "Menunggu Pembayaran"
    when "active"
      latest_return_date = rental_items.maximum(:return_date)
      latest_return_date && latest_return_date <= Date.current ? "Menunggu Pengembalian" : "Sedang Disewa"
    when "returned" then "Selesai"
    when "rejected" then "Ditolak"
    when "cancelled" then "Dibatalkan"
    else status
    end
  end

  def self.available_quantity_for(product:, start_date:, return_date:, shoe_inventory: nil, excluding_rental_id: nil)
    reserved_items = RentalItem.joins(:rental)
      .where(product_id: product.id, shoe_inventory_id: shoe_inventory&.id)
      .where(
        "rentals.status = :pending OR (rentals.status IN (:allocated) AND rentals.stock_deducted = :not_deducted)",
        pending: "pending_confirmation",
        allocated: %w[confirmed active],
        not_deducted: false
      )
      .where("rental_items.start_date < ? AND rental_items.return_date > ?", return_date, start_date)
    reserved_items = reserved_items.where.not(rentals: { id: excluding_rental_id }) if excluding_rental_id
    reserved_items = reserved_items.to_a
    boundaries = ([ start_date ] + reserved_items.map(&:start_date).select { |date| date < return_date }).uniq.sort
    peak_reserved = boundaries.map do |date|
      reserved_items.sum do |item|
        item.start_date <= date && item.return_date > date ? item.quantity : 0
      end
    end.max || 0

    [ (shoe_inventory || product).rental_stock - peak_reserved, 0 ].max
  end

  def self.available_quantity_for_size(product:, size:, start_date:, return_date:)
    stock = product.shoe_inventories.where(active: true, size: size).sum(:rental_stock)
    reserved_items = RentalItem.joins(:rental)
      .where(product_id: product.id, inventory_size: size)
      .where(
        "rentals.status = :pending OR (rentals.status IN (:allocated) AND rentals.stock_deducted = :not_deducted)",
        pending: "pending_confirmation",
        allocated: %w[confirmed active],
        not_deducted: false
      )
      .where("rental_items.start_date < ? AND rental_items.return_date > ?", return_date, start_date)
      .to_a
    boundaries = ([ start_date ] + reserved_items.map(&:start_date).select { |date| date < return_date }).uniq.sort
    peak_reserved = boundaries.map do |date|
      reserved_items.sum { |item| item.start_date <= date && item.return_date > date ? item.quantity : 0 }
    end.max || 0

    [ stock - peak_reserved, 0 ].max
  end

  def self.check_confirmation_availability!(rental)
    requested_items = rental.rental_items.map do |item|
      {
        product_id: item.product_id,
        shoe_inventory_id: item.shoe_inventory_id,
        size: item.inventory_size,
        quantity: item.quantity,
        start_date: item.start_date,
        return_date: item.return_date
      }
    end
    product_scope = Product.where(id: requested_items.map { |item| item.fetch(:product_id) }.uniq)
    product_scope.update_all("rental_stock = rental_stock")
    products = product_scope.order(:id).lock.index_by(&:id)
    inventory_ids = requested_items.filter_map { |item| item[:shoe_inventory_id] }.uniq
    inventories = ShoeInventory.where(id: inventory_ids).order(:id).lock.index_by(&:id)
    check_availability!(requested_items, products, inventories, excluding_rental_id: rental.id)
  end

  class << self
    private

    def normalize_items(items)
      raise ArgumentError, "Minimal satu item penyewaan wajib disertakan." unless items.is_a?(Array) && items.any?

      items.map do |item|
        attributes = item.to_h.symbolize_keys
        product_id = positive_integer(attributes.fetch(:product_id))
        quantity = positive_integer(attributes.fetch(:quantity))
        shoe_inventory_id = attributes[:shoe_inventory_id].present? ? positive_integer(attributes[:shoe_inventory_id]) : nil
        size = attributes[:size].present? ? attributes[:size].to_s.strip : nil
        if size && !SHOE_SIZES.include?(size)
          raise ArgumentError, "Ukuran sepatu harus antara 38 sampai 43."
        end
        start_date = Date.iso8601(attributes.fetch(:start_date).to_s)
        return_date = Date.iso8601(attributes.fetch(:return_date).to_s)
        raise ArgumentError, "Tanggal kembali harus setelah tanggal mulai." unless return_date > start_date

        {
          product_id: product_id,
          shoe_inventory_id: shoe_inventory_id,
          size: size,
          quantity: quantity,
          start_date: start_date,
          return_date: return_date
        }
      rescue KeyError, ArgumentError, TypeError
        raise ArgumentError, "Item sewa memerlukan product_id, jumlah positif, dan tanggal ISO yang valid."
      end
    end

    def positive_integer(value)
      raise ArgumentError unless value.to_s.match?(/\A[1-9]\d*\z/)

      Integer(value)
    end

    def check_availability!(requested_items, products, inventories, excluding_rental_id: nil)
      requested_items.group_by { |item| [ item.fetch(:product_id), item[:size], item[:shoe_inventory_id] ] }.each do |(product_id, size, shoe_inventory_id), items|
        product = products.fetch(product_id)
        inventory = inventories[shoe_inventory_id]
        raise ActiveRecord::RecordNotFound if shoe_inventory_id && !inventory
        if inventory
          raise ArgumentError, "Inventori tidak termasuk produk yang dipilih." unless inventory.product_id == product.id && inventory.active?
        elsif product.shoe?
          raise ArgumentError, "Pilih ukuran sepatu yang tersedia." unless SHOE_SIZES.include?(size.to_s)
        elsif size.present?
          raise ArgumentError, "Ukuran sepatu tidak berlaku untuk produk ini."
        end

        existing_scope = RentalItem.joins(:rental)
          .where(
            "rentals.status = :pending OR (rentals.status IN (:allocated) AND rentals.stock_deducted = :not_deducted)",
            pending: "pending_confirmation",
            allocated: %w[confirmed active],
            not_deducted: false
          )
        existing_scope = if size.present?
          existing_scope.where(product_id: product_id, inventory_size: size)
        else
          existing_scope.where(product_id: product_id, shoe_inventory_id: shoe_inventory_id)
        end
          .where("rental_items.start_date < ? AND rental_items.return_date > ?",
            items.map { |item| item.fetch(:return_date) }.max,
            items.map { |item| item.fetch(:start_date) }.min)
        existing_scope = existing_scope.where.not(rentals: { id: excluding_rental_id }) if excluding_rental_id
        existing_items = existing_scope
          .to_a
        boundaries = (items.flat_map { |item| [ item.fetch(:start_date), item.fetch(:return_date) ] } +
          existing_items.flat_map { |item| [ item.start_date, item.return_date ] }).uniq.sort

        boundaries.each_cons(2) do |period_start, period_end|
          next unless period_end > period_start

          existing_quantity = existing_items.sum do |item|
            item.start_date <= period_start && item.return_date > period_start ? item.quantity : 0
          end
          requested_quantity = items.sum do |item|
            item.fetch(:start_date) <= period_start && item.fetch(:return_date) > period_start ? item.fetch(:quantity) : 0
          end
          stock = if size.present?
            product.shoe_inventories.where(active: true, size: size).sum(:rental_stock)
          else
            (inventory || product).rental_stock
          end
          label = size.present? ? "#{product.name} ukuran #{size}" : (inventory&.display_label || product.name)
          raise AvailabilityError, label if existing_quantity + requested_quantity > stock
        end
      end
    end
  end

  private

  def assign_shoe_inventories!(assignments)
    shoe_items = rental_items.includes(:product).select { |item| item.product.shoe? }
    unassigned_items = shoe_items.reject(&:shoe_inventory_id?)
    return if unassigned_items.empty?

    assignments = Array(assignments).index_by { |assignment| assignment[:rental_item_id].to_i }
    unless assignments.keys.sort == unassigned_items.map(&:id).sort
      errors.add(:status, "Pilih inventori fisik sepatu untuk setiap item sebelum menyetujui penyewaan.")
      raise ActiveRecord::RecordInvalid, self
    end

    unassigned_items.each do |item|
      inventory_id = assignments.fetch(item.id)[:shoe_inventory_id].to_i
      inventory = ShoeInventory.where(
        id: inventory_id,
        product_id: item.product_id,
        active: true,
        size: item.inventory_size
      ).lock.first
      unless inventory
        errors.add(:status, "Inventori fisik harus aktif dan memiliki ukuran yang diminta.")
        raise ActiveRecord::RecordInvalid, self
      end

      available = self.class.available_quantity_for(
        product: item.product,
        shoe_inventory: inventory,
        start_date: item.start_date,
        return_date: item.return_date,
        excluding_rental_id: id
      )
      if available < item.quantity
        errors.add(:status, "#{inventory.display_label}: stok tidak mencukupi pada tanggal yang dipilih.")
        raise ActiveRecord::RecordInvalid, self
      end

      item.update!(
        shoe_inventory: inventory,
        inventory_model_name: inventory.name,
        inventory_design_name: inventory.design_name,
        inventory_color: inventory.color,
        inventory_size: inventory.size,
        inventory_attributes: inventory.options.merge("capacity" => inventory.capacity).compact_blank
      )
    end
  end

  def assign_rental_number
    self.rental_number ||= "SEWA-#{Time.current.strftime('%y%m%d')}-#{SecureRandom.hex(4).upcase}"
  end

  def assign_payment_code
    self.payment_code ||= TransactionCodeSequence.next_code!
  end

  def sync_return_status
    self.return_status = if status == "returned"
      "returned"
    elsif status.in?(%w[cancelled rejected])
      "not_applicable"
    else
      "not_returned"
    end
  end

  def record_initial_status
    status_histories.create!(to_status: status, changed_by: status_change_actor)
  end

  def record_return_conditions!(return_conditions)
    if return_conditions.is_a?(Hash)
      is_single_condition = return_conditions.key?(:rental_item_id) || return_conditions.key?("rental_item_id")
      return_conditions = is_single_condition ? [ return_conditions ] : return_conditions.values
    end
    submitted_conditions = Array(return_conditions).map do |attributes|
      attributes = attributes.to_h if attributes.respond_to?(:to_unsafe_h)
      unless attributes.is_a?(Hash)
        errors.add(:status, "kondisi setiap barang wajib dicatat saat pengembalian.")
        raise ActiveRecord::RecordInvalid, self
      end

      attributes.to_h.symbolize_keys
    end
    conditions_by_item_id = submitted_conditions.index_by { |attributes| attributes[:rental_item_id].to_i }
    items = rental_items.order(:id).lock.to_a

    if conditions_by_item_id.keys.sort != items.map(&:id).sort
      errors.add(:status, "kondisi setiap barang wajib dicatat saat pengembalian.")
      raise ActiveRecord::RecordInvalid, self
    end

    items.each do |item|
      condition = conditions_by_item_id.fetch(item.id)[:condition].to_s.strip
      unless RETURN_CONDITIONS.include?(condition)
        errors.add(:status, "kondisi setiap barang wajib dipilih: baik, rusak, atau hilang.")
        raise ActiveRecord::RecordInvalid, self
      end

      item.update!(return_condition: condition)
    end
  end

  def adjust_stock_for_transition!(target_status)
    if target_status == "active" && !stock_deducted?
      adjust_product_stock!(rental_items.group(:shoe_inventory_id, :product_id).sum(:quantity), :deduct)
    elsif target_status.in?(%w[cancelled rejected]) && stock_deducted?
      adjust_product_stock!(rental_items.group(:shoe_inventory_id, :product_id).sum(:quantity), :restore)
    elsif target_status == "returned" && stock_deducted?
      good_items = rental_items.where(return_condition: "good")
      adjust_product_stock!(good_items.group(:shoe_inventory_id, :product_id).sum(:quantity), :restore)
    end
  end

  def adjust_product_stock!(quantities_by_inventory, operation)
    return if quantities_by_inventory.empty?

    product_ids = quantities_by_inventory.keys.map(&:last).uniq.sort
    Product.where(id: product_ids).update_all("rental_stock = rental_stock")
    products = Product.where(id: product_ids).order(:id).lock.index_by(&:id)
    inventory_ids = quantities_by_inventory.keys.map(&:first).compact.uniq.sort
    ShoeInventory.where(id: inventory_ids).update_all("rental_stock = rental_stock")
    inventories = ShoeInventory.where(id: inventory_ids).order(:id).lock.index_by(&:id)

    quantities_by_inventory.sort.each do |(shoe_inventory_id, product_id), quantity|
      product = products.fetch(product_id)
      inventory = inventories[shoe_inventory_id] || product
      stock_scope = inventory.class.where(id: inventory.id)
      if operation == :deduct
        stock_scope = stock_scope.where("rental_stock >= ?", quantity)
        adjustment = [ "rental_stock = rental_stock - ?, updated_at = ?", quantity, Time.current ]
      else
        adjustment = [ "rental_stock = rental_stock + ?, updated_at = ?", quantity, Time.current ]
      end

      raise AvailabilityError, (inventories[shoe_inventory_id]&.display_label || product.name) unless stock_scope.update_all(adjustment) == 1
    end
  end
end
