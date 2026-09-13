class CreateVisualhubSettings < ActiveRecord::Migration[8.1]
  def change
    create_table :visualhub_settings do |t|
      # Branding & Identidad
      t.string :app_name, default: "OpenITIL", null: false
      t.string :app_subtitle, default: "Gestión de Servicios y Activos TI"
      t.string :logo_url
      t.string :login_title, default: "Iniciar Sesión en OpenITIL"
      t.string :footer_text, default: "OpenITIL - Mesa de Ayuda y Gestión de Servicios ITIL"

      # Temas y Paleta de Colores
      t.string :primary_color, default: "#4f46e5", null: false
      t.string :accent_color, default: "#06b6d4", null: false
      t.string :sidebar_bg, default: "#0f172a", null: false
      t.boolean :default_dark_mode, default: false, null: false

      # Suite de Accesibilidad WCAG 2.2
      t.boolean :accessibility_enabled, default: true, null: false
      t.string :widget_position, default: "bottom-right", null: false
      t.boolean :tts_enabled, default: true, null: false
      t.string :tts_default_lang, default: "es-ES", null: false
      t.float :tts_speed, default: 1.0, null: false
      t.boolean :point_to_read, default: true, null: false
      t.boolean :keyboard_shortcuts_enabled, default: true, null: false
      t.boolean :high_contrast_default, default: false, null: false
      t.boolean :readable_font_default, default: false, null: false

      t.timestamps
    end
  end
end
