class TicketCategory < ApplicationRecord
  has_many :tickets, dependent: :nullify
  has_many :kb_articles, dependent: :nullify

  validates :name, presence: true, uniqueness: true
end
