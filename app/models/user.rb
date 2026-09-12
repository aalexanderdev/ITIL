class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  ROLES = %w[admin technician user].freeze

  belongs_to :department, optional: true
  has_many :requested_tickets, class_name: "Ticket", foreign_key: "requester_id", dependent: :nullify
  has_many :assigned_tickets, class_name: "Ticket", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :assets, dependent: :nullify
  has_many :ticket_updates, dependent: :destroy
  has_many :kb_articles, dependent: :nullify

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }

  scope :technicians, -> { where(role: %w[admin technician], active: true) }
  scope :active, -> { where(active: true) }

  def admin?
    role == "admin"
  end

  def technician?
    role == "technician"
  end

  def end_user?
    role == "user"
  end

  def staff?
    admin? || technician?
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
end
