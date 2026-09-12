class CreateChatSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :chat_settings do |t|
      # Apariencia
      t.integer :panel_width_px, default: 380, null: false
      t.string :bubble_color, default: "#4f46e5", null: false
      t.string :mention_color, default: "#4338ca", null: false
      t.string :launcher_color, default: "#4f46e5", null: false
      t.integer :font_size, default: 14, null: false

      # Rendimiento / Polling
      t.integer :poll_messages_ms, default: 2000, null: false
      t.integer :poll_conversations_ms, default: 10000, null: false
      t.integer :poll_online_users_ms, default: 30000, null: false
      t.integer :poll_presence_ms, default: 30000, null: false
      t.integer :max_message_length, default: 2000, null: false

      # Comportamiento y Funcionalidades
      t.boolean :reactions_enabled, default: true, null: false
      t.boolean :notification_sound_enabled, default: true, null: false
      t.boolean :presence_enabled, default: true, null: false
      t.boolean :typing_indicator_enabled, default: true, null: false
      t.boolean :read_receipts_enabled, default: true, null: false

      # Conversión a Tickets
      t.boolean :ticket_conversion_enabled, default: true, null: false
      t.boolean :ticket_conversion_on_received, default: true, null: false
      t.boolean :ticket_conversion_on_sent, default: false, null: false
      t.string :ticket_conversion_requester, default: "converter", null: false

      # Avisos de Ciclo de Vida ITIL
      t.boolean :notify_on_assignment, default: true, null: false
      t.boolean :notify_on_solution, default: true, null: false
      t.boolean :notify_on_comment, default: true, null: false
      t.boolean :notify_on_private_note, default: true, null: false

      # Botones de acceso directo (JSON)
      t.text :shortcut_buttons_json

      t.timestamps
    end
  end
end
