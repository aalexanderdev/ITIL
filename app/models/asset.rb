class Asset < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :department, optional: true
  belongs_to :location, optional: true
  has_many :tickets, dependent: :nullify

  ASSET_TYPES = {
    "computer" => "Computadora / Laptop",
    "server" => "Servidor",
    "network_device" => "Dispositivo de Red",
    "printer" => "Impresora",
    "monitor" => "Monitor",
    "phone" => "Teléfono / VoIP",
    "other" => "Otro"
  }.freeze

  STATUSES = {
    "in_use" => "En uso",
    "in_stock" => "En almacén / Stock",
    "in_repair" => "En reparación / Mantenimiento",
    "disposed" => "De baja / Desincorporado"
  }.freeze

  before_validation :generate_asset_tag, on: :create

  validates :asset_tag, presence: true, uniqueness: true
  validates :name, presence: true
  validates :asset_type, inclusion: { in: ASSET_TYPES.keys }
  validates :status, inclusion: { in: STATUSES.keys }

  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(asset_type: type) if type.present? }
  scope :by_status, ->(status) { where(status: status) if status.present? }

  def type_name
    ASSET_TYPES[asset_type] || asset_type.titleize
  end

  def status_name
    STATUSES[status] || status.titleize
  end

  def status_badge_class
    case status
    when "in_use" then "badge-success"
    when "in_stock" then "badge-info"
    when "in_repair" then "badge-warning"
    when "disposed" then "badge-danger"
    else "badge-secondary"
    end
  end

  def icon_name
    case asset_type
    when "computer" then "laptop"
    when "server" then "server"
    when "network_device" then "network"
    when "printer" then "printer"
    when "monitor" then "monitor"
    when "phone" then "phone"
    else "box"
    end
  end

  def display_name
    "#{asset_tag} - #{name} (#{manufacturer} #{model})".strip
  end

  private

  def generate_asset_tag
    return if asset_tag.present?

    prefix = case asset_type
    when "computer" then "PC"
    when "server" then "SRV"
    when "network_device" then "NET"
    when "printer" then "PRN"
    else "AST"
    end
    self.asset_tag = "#{prefix}-#{SecureRandom.alphanumeric(6).upcase}"
  end
end
