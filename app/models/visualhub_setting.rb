class VisualhubSetting < ApplicationRecord
  HEX_COLOR_REGEX = /\A#(?:[0-9a-fA-F]{3}){1,2}\z/

  WIDGET_POSITIONS = %w[bottom-right bottom-left top-right top-left].freeze

  TTS_LANGUAGES = {
    "es-ES" => "Español (España)",
    "es-AR" => "Español (Argentina / Rioplatense)",
    "es-MX" => "Español (México)",
    "es-CO" => "Español (Colombia)",
    "en-US" => "English (United States)",
    "en-GB" => "English (United Kingdom)",
    "pt-BR" => "Português (Brasil)",
    "fr-FR" => "Français (France)"
  }.freeze

  LOGO_ICONS = {
    "cube" => {
      name: "Cubo Isométrico",
      description: "Minimalista, arquitectura TI y catálogo CMDB",
      path: '<path d="m21.12 6.4-9-5.18a2 2 0 0 0-2 0l-9 5.18a2 2 0 0 0-1 1.73v10.36a2 2 0 0 0 1 1.73l9 5.18a2 2 0 0 0 2 0l9-5.18a2 2 0 0 0 1-1.73V8.13a2 2 0 0 0-1-1.73Z"/><path d="M12 22V12"/><path d="m3.27 6.96 8.73 5.04 8.73-5.04"/>'
    },
    "minimal_o" => {
      name: "Anillo OpenITIL",
      description: "Monograma circular minimalista y ciclo continuo",
      path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="9"/>'
    },
    "layers" => {
      name: "Capas de Servicio",
      description: "Capas de entrega de valor y catálogo ITIL",
      path: '<path d="m12 2 10 5-10 5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>'
    },
    "shield" => {
      name: "Escudo de Servicio",
      description: "Seguridad, estabilidad y cumplimiento SLA",
      path: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'
    },
    "network" => {
      name: "Topología de Red",
      description: "Conectividad de infraestructura y servidores",
      path: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>'
    },
    "terminal" => {
      name: "Terminal de Comandos",
      description: "Operaciones técnicas y administración de sistemas",
      path: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>'
    },
    "sparkle" => {
      name: "Destello Clásico",
      description: "Icono clásico de OpenITIL",
      path: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>'
    }
  }.freeze

  validates :app_name, presence: true
  validates :primary_color, presence: true, format: { with: HEX_COLOR_REGEX, message: "debe ser un color hexadecimal válido (ej. #4f46e5)" }
  validates :accent_color, presence: true, format: { with: HEX_COLOR_REGEX, message: "debe ser un color hexadecimal válido (ej. #06b6d4)" }
  validates :sidebar_bg, presence: true, format: { with: HEX_COLOR_REGEX, message: "debe ser un color hexadecimal válido (ej. #0f172a)" }
  validates :widget_position, inclusion: { in: WIDGET_POSITIONS }
  validates :tts_default_lang, inclusion: { in: TTS_LANGUAGES.keys }
  validates :tts_speed, numericality: { greater_than_or_equal_to: 0.5, less_than_or_equal_to: 2.0 }
  validates :logo_icon, inclusion: { in: LOGO_ICONS.keys }

  def self.current
    first_or_create!(
      app_name: "OpenITIL",
      app_subtitle: "Gestión de Servicios y Activos TI",
      login_title: "Iniciar Sesión en OpenITIL",
      footer_text: "OpenITIL - Mesa de Ayuda y Gestión de Servicios ITIL",
      primary_color: "#4f46e5",
      accent_color: "#06b6d4",
      sidebar_bg: "#0f172a",
      logo_icon: "cube",
      default_dark_mode: false,
      accessibility_enabled: true,
      widget_position: "bottom-right",
      tts_enabled: true,
      tts_default_lang: "es-ES",
      tts_speed: 1.0,
      point_to_read: true,
      keyboard_shortcuts_enabled: true,
      high_contrast_default: false,
      readable_font_default: false
    )
  end

  def css_variables
    "--vh-primary: #{primary_color}; --vh-accent: #{accent_color}; --vh-sidebar-bg: #{sidebar_bg};"
  end

  def render_logo_svg(size: 22, stroke_width: 2.2, css_class: "")
    icon_info = LOGO_ICONS[logo_icon] || LOGO_ICONS["cube"]
    svg_body = icon_info[:path]

    %(<svg width="#{size}" height="#{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="#{stroke_width}" stroke-linecap="round" stroke-linejoin="round" class="#{css_class}">#{svg_body}</svg>).html_safe
  end
end
