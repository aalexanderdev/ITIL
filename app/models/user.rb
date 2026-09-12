class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  ROLES = %w[admin technician user].freeze

  belongs_to :department, optional: true
  belongs_to :profile, optional: true
  has_many :requested_tickets, class_name: "Ticket", foreign_key: "requester_id", dependent: :nullify
  has_many :assigned_tickets, class_name: "Ticket", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :assets, dependent: :nullify
  has_many :ticket_updates, dependent: :destroy
  has_many :kb_articles, dependent: :nullify

  # HelpdeskChat Associations
  has_many :chat_conversation_users, dependent: :destroy
  has_many :chat_conversations, through: :chat_conversation_users
  has_many :chat_messages, dependent: :destroy
  has_many :chat_message_reactions, dependent: :destroy
  has_one :chat_presence, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }

  scope :technicians, -> { where(role: %w[admin technician], active: true) }
  scope :active, -> { where(active: true) }

  def effective_profile
    profile || Profile.default_for(role)
  end

  def can?(permission)
    effective_profile&.send(permission) || false
  end

  def admin?
    role == "admin" || can?(:admin_access)
  end

  def technician?
    role == "technician" || (can?(:ticket_assign) && !admin?)
  end

  def end_user?
    role == "user" && !staff?
  end

  def staff?
    admin? || role == "technician" || can?(:ticket_assign) || can?(:ticket_solve)
  end

  def full_name
    if first_name.present? || last_name.present?
      "#{first_name} #{last_name}".strip
    else
      email_address.split("@").first.humanize
    end
  end

  def display_name
    "#{full_name} (#{role.titleize})"
  end

  def online?
    chat_presence&.online? || false
  end

  def self_chat_conversation
    ChatConversation.find_or_create_self(self)
  end

  def send_system_chat_notice(content, link_url = nil)
    conv = self_chat_conversation
    conv.chat_messages.create!(
      user: self,
      content: content,
      link_url: link_url
    )
  end
end
