class TransactionCodeSequence < ApplicationRecord
  validates :sequence_date, presence: true
  validates :last_number, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  def self.next_code!
    sequence_date = Date.current
    code = nil

    transaction do
      sequence = find_or_create_by!(sequence_date: sequence_date) do |record|
        record.last_number = 0
      end
      where(id: sequence.id).update_all("last_number = last_number + 1, updated_at = CURRENT_TIMESTAMP")
      sequence.reload
      raise RangeError, "Kode transaksi hari ini sudah mencapai batas 9999." if sequence.last_number > 9_999

      code = "ARU-#{sequence_date.strftime('%Y%m%d')}-#{sequence.last_number.to_s.rjust(4, '0')}"
    end

    code
  end
end
