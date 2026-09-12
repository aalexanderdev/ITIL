class Profile < ApplicationRecord
  HEX_COLOR_REGEX = /\A#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z/

  has_many :users, dependent: :nullify

  validates :name, presence: true, uniqueness: { case_sensitive: false }
  validates :base_role, inclusion: { in: User::ROLES }
  validates :color, presence: true, format: { with: HEX_COLOR_REGEX }

  scope :ordered, -> { order(:name) }
  scope :default_profile, -> { where(is_default: true) }

  # Grupos de permisos para vistas y matrices
  PERMISSION_GROUPS = {
    helpdesk: {
      label: "Mesa de Ayuda (Helpdesk / Tickets)",
      icon: "ticket",
      permissions: {
        ticket_all_view: "Ver todos los tickets de la organización (no solo los propios)",
        ticket_create: "Crear nuevos tickets e incidencias",
        ticket_edit: "Editar propiedades y categorización de tickets",
        ticket_assign: "Asignar técnicos y transferir tickets",
        ticket_solve: "Registrar soluciones formales a incidencias",
        ticket_close: "Cerrar tickets formalmente",
        ticket_delete: "Eliminar tickets de la plataforma",
        ticket_private_notes: "Crear y visualizar notas técnicas privadas internas"
      }
    },
    assets: {
      label: "Gestión de Activos (CMDB / ITAM)",
      icon: "laptop",
      permissions: {
        asset_view: "Consultar inventario de equipos y fichas técnicas",
        asset_manage: "Crear, modificar y dar de baja activos informáticos"
      }
    },
    kb: {
      label: "Base de Conocimiento (FAQ)",
      icon: "book",
      permissions: {
        kb_view: "Consultar manuales y artículos de autoayuda",
        kb_manage: "Redactar, publicar y gestionar artículos de conocimiento"
      }
    },
    chat: {
      label: "HelpdeskChat en Tiempo Real",
      icon: "message-circle",
      permissions: {
        chat_access: "Acceso al chat en tiempo real y mensajería",
        chat_convert_ticket: "Convertir mensajes de chat directamente en tickets",
        chat_config: "Acceso y modificación de configuración global del chat"
      }
    },
    admin: {
      label: "Administración del Sistema",
      icon: "shield",
      permissions: {
        admin_access: "Gestión de usuarios, perfiles, departamentos, sedes y ajustes"
      }
    }
  }.freeze

  def self.default_for(role)
    where(base_role: role).order(is_default: :desc, id: :asc).first ||
      find_by(name: "Super-Administrador")
  end

  def permissions_count
    PERMISSION_GROUPS.values.sum do |group|
      group[:permissions].keys.count { |p| send(p) }
    end
  end

  def total_permissions_count
    PERMISSION_GROUPS.values.sum { |g| g[:permissions].size }
  end
end
