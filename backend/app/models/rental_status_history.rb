class RentalStatusHistory < ApplicationRecord
  belongs_to :rental
  belongs_to :changed_by, class_name: "User", optional: true

  validates :to_status, inclusion: { in: Rental::STATUSES }
  validates :from_status, inclusion: { in: Rental::STATUSES }, allow_nil: true
end
