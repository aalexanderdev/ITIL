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

  after_create_commit :dispatch_chat_notice

  scope :public_updates, -> { where.not(update_type: "private_note") }
  scope :recent, -> { order(created_at: :asc) }

  def type_name
    UPDATE_TYPES[update_type] || update_type.titleize
  end

  def comment?
    update_type == "comment"
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

  private

  def dispatch_chat_notice
    link = "/tickets/#{ticket.id}"

    if comment?
      if ticket.requester && ticket.requester_id != user_id
        ticket.requester.send_system_chat_notice(
          "💬 Nuevo seguimiento en Ticket ##{ticket.ticket_number} por #{user.full_name}: #{content.truncate(80)}",
          link
        )
      end
      if ticket.assigned_to && ticket.assigned_to_id != user_id
        ticket.assigned_to.send_system_chat_notice(
          "💬 Nuevo seguimiento en Ticket ##{ticket.ticket_number} por #{user.full_name}: #{content.truncate(80)}",
          link
        )
      end
    elsif solution?
      if ticket.requester && ticket.requester_id != user_id
        ticket.requester.send_system_chat_notice(
          "🏆 Solución registrada en Ticket ##{ticket.ticket_number}: #{content.truncate(80)}",
          link
        )
      end
    elsif private?
      # Only notify assigned tech if not the author
      if ticket.assigned_to && ticket.assigned_to_id != user_id
        ticket.assigned_to.send_system_chat_notice(
          "🔒 Nota técnica interna en Ticket ##{ticket.ticket_number} por #{user.full_name}",
          link
        )
      end
    end
  end
end
