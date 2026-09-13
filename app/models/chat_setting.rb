class ChatSetting < ApplicationRecord
  DEFAULT_SHORTCUTS = [
    { "label" => "Helpdesk", "url" => "/tickets" },
    { "label" => "Inventario CMDB", "url" => "/assets" },
    { "label" => "Base Conocimiento", "url" => "/kb_articles" }
  ].freeze

  HEX_COLOR_REGEX = /\A#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z/

  validates :panel_width_px, numericality: { greater_than_or_equal_to: 320, less_than_or_equal_to: 420 }
  validates :font_size, numericality: { greater_than_or_equal_to: 10, less_than_or_equal_to: 24 }
  validates :bubble_color, :mention_color, :launcher_color, presence: true, format: { with: HEX_COLOR_REGEX }
  validates :poll_messages_ms, numericality: { greater_than_or_equal_to: 500, less_than_or_equal_to: 30000 }
  validates :poll_conversations_ms, numericality: { greater_than_or_equal_to: 1000, less_than_or_equal_to: 60000 }
  validates :poll_online_users_ms, numericality: { greater_than_or_equal_to: 1000, less_than_or_equal_to: 120000 }
  validates :poll_presence_ms, numericality: { greater_than_or_equal_to: 1000, less_than_or_equal_to: 120000 }
  validates :max_message_length, numericality: { greater_than_or_equal_to: 100, less_than_or_equal_to: 10000 }
  validates :ticket_conversion_requester, inclusion: { in: %w[converter author] }

  def self.current
    first_or_create!(
      panel_width_px: 380,
      bubble_color: "#4f46e5",
      mention_color: "#4338ca",
      launcher_color: "#4f46e5",
      font_size: 14,
      poll_messages_ms: 2000,
      poll_conversations_ms: 10000,
      poll_online_users_ms: 30000,
      poll_presence_ms: 30000,
      max_message_length: 2000,
      reactions_enabled: true,
      notification_sound_enabled: true,
      presence_enabled: true,
      typing_indicator_enabled: true,
      read_receipts_enabled: true,
      ticket_conversion_enabled: true,
      ticket_conversion_on_received: true,
      ticket_conversion_on_sent: false,
      ticket_conversion_requester: "converter",
      notify_on_assignment: true,
      notify_on_solution: true,
      notify_on_comment: true,
      notify_on_private_note: true,
      shortcut_buttons_json: DEFAULT_SHORTCUTS.to_json
    )
  end

  def parsed_shortcut_buttons
    if shortcut_buttons_json.present?
      JSON.parse(shortcut_buttons_json) rescue DEFAULT_SHORTCUTS
    else
      DEFAULT_SHORTCUTS
    end
  end
end
