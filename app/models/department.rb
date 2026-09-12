class Department < ApplicationRecord
  belongs_to :location, optional: true
  has_many :users, dependent: :nullify
  has_many :assets, dependent: :nullify

  validates :name, presence: true, uniqueness: true
end
