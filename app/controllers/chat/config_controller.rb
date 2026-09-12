module Chat
  class ConfigController < BaseController
    def handle
      action = requested_action || "get"

      case action
      when "get"
        get_config
      when "update", "save"
        update_config
      else
        get_config
      end
    end

    private

    def get_config
      setting = ChatSetting.current

      render json: {
        panel_width_px: setting.panel_width_px,
        bubble_color: setting.bubble_color,
        mention_color: setting.mention_color,
        launcher_color: setting.launcher_color,
        font_size: setting.font_size,
        poll_messages_ms: setting.poll_messages_ms,
        poll_conversations_ms: setting.poll_conversations_ms,
        poll_online_users_ms: setting.poll_online_users_ms,
        poll_presence_ms: setting.poll_presence_ms,
        max_message_length: setting.max_message_length,
        reactions_enabled: setting.reactions_enabled,
        notification_sound_enabled: setting.notification_sound_enabled,
        presence_enabled: setting.presence_enabled,
        typing_indicator_enabled: setting.typing_indicator_enabled,
        read_receipts_enabled: setting.read_receipts_enabled,
        ticket_conversion_enabled: setting.ticket_conversion_enabled,
        ticket_conversion_on_received: setting.ticket_conversion_on_received,
        ticket_conversion_on_sent: setting.ticket_conversion_on_sent,
        ticket_conversion_requester: setting.ticket_conversion_requester,
        notify_on_assignment: setting.notify_on_assignment,
        notify_on_solution: setting.notify_on_solution,
        notify_on_comment: setting.notify_on_comment,
        notify_on_private_note: setting.notify_on_private_note
      }
    end

    def update_config
      unless current_user.admin?
        return render json: { success: false, error: "forbidden" }, status: :forbidden
      end

      setting = ChatSetting.current
      updates = {}

      %i[
        panel_width_px bubble_color mention_color launcher_color font_size
        poll_messages_ms poll_conversations_ms poll_online_users_ms poll_presence_ms max_message_length
        reactions_enabled notification_sound_enabled presence_enabled typing_indicator_enabled read_receipts_enabled
        ticket_conversion_enabled ticket_conversion_on_received ticket_conversion_on_sent ticket_conversion_requester
        notify_on_assignment notify_on_solution notify_on_comment notify_on_private_note
      ].each do |key|
        updates[key] = params[key] if params.key?(key)
      end

      if setting.update(updates)
        render json: { success: true }
      else
        render json: { success: false, errors: setting.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end
end
