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

  validates :app_name, presence: true
  validates :primary_color, presence: true, format: { with: HEX_COLOR_REGEX, message: "debe ser un color hexadecimal válido (ej. #4f46e5)" }
  validates :accent_color, presence: true, format: { with: HEX_COLOR_REGEX, message: "debe ser un color hexadecimal válido (ej. #06b6d4)" }
  validates :sidebar_bg, presence: true, format: { with: HEX_COLOR_REGEX, message: "debe ser un color hexadecimal válido (ej. #0f172a)" }
  validates :widget_position, inclusion: { in: WIDGET_POSITIONS }
  validates :tts_default_lang, inclusion: { in: TTS_LANGUAGES.keys }
  validates :tts_speed, numericality: { greater_than_or_equal_to: 0.5, less_than_or_equal_to: 2.0 }

  def self.current
    first_or_create!(
      app_name: "OpenITIL",
      app_subtitle: "Gestión de Servicios y Activos TI",
      login_title: "Iniciar Sesión en OpenITIL",
      footer_text: "OpenITIL - Mesa de Ayuda y Gestión de Servicios ITIL",
      primary_color: "#4f46e5",
      accent_color: "#06b6d4",
      sidebar_bg: "#0f172a",
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
end
