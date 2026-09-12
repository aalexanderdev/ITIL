class Location < ApplicationRecord
  has_many :departments, dependent: :nullify
  has_many :assets, dependent: :nullify

  validates :name, presence: true, uniqueness: true

  def full_location
    parts = [ name ]
    parts << "Edif. #{building}" if building.present?
    parts << "Piso #{floor}" if floor.present?
    parts << "Sala/Oficina #{room}" if room.present?
    parts.join(" - ")
  end
end
