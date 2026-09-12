class Ticket < ApplicationRecord
  belongs_to :requester, class_name: "User"
  belongs_to :assigned_to, class_name: "User", optional: true
  belongs_to :asset, optional: true
  belongs_to :ticket_category, optional: true
  has_many :ticket_updates, -> { order(created_at: :asc) }, dependent: :destroy

  TICKET_TYPES = {
    "incident" => "Incidencia",
    "request" => "Petición de Servicio"
  }.freeze

  STATUSES = {
    "new_ticket" => "Nuevo",
    "assigned" => "Asignado",
    "in_progress" => "En curso",
    "pending" => "En espera",
    "solved" => "Resuelto",
    "closed" => "Cerrado"
  }.freeze

  LEVELS = {
    1 => "Muy baja",
    2 => "Baja",
    3 => "Media",
    4 => "Alta",
    5 => "Muy alta"
  }.freeze

  PRIORITIES = {
    1 => "Muy baja",
    2 => "Baja",
    3 => "Media",
    4 => "Alta",
    5 => "Muy alta",
    6 => "Mayor / Crítica"
  }.freeze

  before_validation :generate_ticket_number, on: :create
  before_validation :calculate_priority
  before_validation :calculate_due_date, on: :create

  after_create_commit :dispatch_create_chat_notice
  after_update_commit :dispatch_update_chat_notice

  validates :ticket_number, presence: true, uniqueness: true
  validates :title, presence: true
  validates :description, presence: true
  validates :ticket_type, inclusion: { in: TICKET_TYPES.keys }
  validates :status, inclusion: { in: STATUSES.keys }
  validates :urgency, inclusion: { in: 1..5 }
  validates :impact, inclusion: { in: 1..5 }
  validates :priority, inclusion: { in: 1..6 }

  scope :recent, -> { order(created_at: :desc) }
  scope :open_tickets, -> { where.not(status: %w[solved closed]) }
  scope :solved_or_closed, -> { where(status: %w[solved closed]) }
  scope :assigned_to_user, ->(user_id) { where(assigned_to_id: user_id) }
  scope :requested_by_user, ->(user_id) { where(requester_id: user_id) }
  scope :by_priority, ->(pri) { where(priority: pri) if pri.present? }
  scope :by_status, ->(st) { where(status: st) if st.present? }

  def type_name
    TICKET_TYPES[ticket_type] || ticket_type.titleize
  end

  def status_name
    STATUSES[status] || status.titleize
  end

  def priority_name
    PRIORITIES[priority] || "Media"
  end

  def urgency_name
    LEVELS[urgency] || "Media"
  end

  def impact_name
    LEVELS[impact] || "Medio"
  end

  def open?
    !%w[solved closed].include?(status)
  end

  def solved?
    status == "solved"
  end

  def closed?
    status == "closed"
  end

  def overdue?
    open? && due_at.present? && due_at < Time.current
  end

  def status_badge_class
    case status
    when "new_ticket" then "badge-primary"
    when "assigned" then "badge-info"
    when "in_progress" then "badge-warning"
    when "pending" then "badge-secondary"
    when "solved" then "badge-success"
    when "closed" then "badge-dark"
    else "badge-secondary"
    end
  end

  def priority_badge_class
    case priority
    when 6 then "badge-critical"
    when 5 then "badge-danger"
    when 4 then "badge-orange"
    when 3 then "badge-warning"
    when 2 then "badge-info"
    else "badge-light"
    end
  end

  # Solución formal registrada
  def current_solution
    ticket_updates.where(update_type: "solution").last
  end

  def total_time_spent
    ticket_updates.sum(:time_spent_minutes)
  end

  private

  def generate_ticket_number
    return if ticket_number.present?

    prefix = ticket_type == "incident" ? "INC" : "REQ"
    year = Time.current.year
    random_id = SecureRandom.random_number(10000..99999)
    self.ticket_number = "#{prefix}-#{year}-#{random_id}"
  end

  # Matriz ITIL Urgencia x Impacto -> Prioridad (1 a 6)
  def calculate_priority
    # Matriz estándar ITIL
    # Matriz [urgency-1][impact-1] (donde 0 es Muy Bajo/Muy Baja, 4 es Muy Alto/Muy Alta)
    matrix = [
      [ 1, 1, 2, 2, 3 ], # Urgencia 1 (Muy baja)
      [ 1, 2, 2, 3, 4 ], # Urgencia 2 (Baja)
      [ 2, 2, 3, 4, 4 ], # Urgencia 3 (Media)
      [ 2, 3, 4, 5, 5 ], # Urgencia 4 (Alta)
      [ 3, 4, 5, 5, 6 ]  # Urgencia 5 (Muy alta)
    ]
    u = (urgency.presence || 3).clamp(1, 5) - 1
    i = (impact.presence || 3).clamp(1, 5) - 1
    self.priority = matrix[u][i]
  end

  def calculate_due_date
    return if due_at.present?

    hours = case priority
    when 6 then 4.hours
    when 5 then 8.hours
    when 4 then 24.hours
    when 3 then 48.hours
    when 2 then 72.hours
    else 120.hours
    end
    self.due_at = Time.current + hours
  end

  def dispatch_create_chat_notice
    setting = ChatSetting.current
    return unless setting.notify_on_assignment

    if assigned_to
      assigned_to.send_system_chat_notice(
        "📋 Asignación: Se te ha asignado el Ticket ##{ticket_number} - #{title}",
        "/tickets/#{id}"
      )
    end
  end

  def dispatch_update_chat_notice
    setting = ChatSetting.current

    if saved_change_to_assigned_to_id? && assigned_to && setting.notify_on_assignment
      assigned_to.send_system_chat_notice(
        "📋 Asignación: Se te ha asignado el Ticket ##{ticket_number} - #{title}",
        "/tickets/#{id}"
      )
    end

    if saved_change_to_status? && status == "solved" && setting.notify_on_solution
      requester&.send_system_chat_notice(
        "✅ Resolución: Tu ticket ##{ticket_number} ha sido resuelto: #{title}",
        "/tickets/#{id}"
      )
    elsif saved_change_to_status? && status == "closed" && setting.notify_on_solution
      requester&.send_system_chat_notice(
        "🔒 Cierre: El ticket ##{ticket_number} ha sido cerrado formalmente.",
        "/tickets/#{id}"
      )
    end
  end
end
