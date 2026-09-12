class TicketUpdate < ApplicationRecord
  belongs_to :ticket
  belongs_to :user

  UPDATE_TYPES = {
    "comment" => "Seguimiento",
    "private_note" => "Nota interna (Técnicos)",
    "task" => "Tarea técnica",
    "solution" => "Solución propuesta"
  }.freeze

  validates :content, presence: true
  validates :update_type, inclusion: { in: UPDATE_TYPES.keys }

  scope :public_updates, -> { where.not(update_type: "private_note") }
  scope :recent, -> { order(created_at: :asc) }

  def type_name
    UPDATE_TYPES[update_type] || update_type.titleize
  end

  def private?
    update_type == "private_note"
  end

  def solution?
    update_type == "solution"
  end

  def task?
    update_type == "task"
  end
end
