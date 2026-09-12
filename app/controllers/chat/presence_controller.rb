module Chat
  class PresenceController < BaseController
    def handle
      action = requested_action || "heartbeat"

      case action
      when "heartbeat"
        ChatPresence.heartbeat_for(current_user)
        render json: { success: true }
      when "online_users"
        render json: { users: ChatPresence.online_user_ids }
      when "offline"
        ChatPresence.set_offline_for(current_user)
        render json: { success: true }
      else
        render json: { success: true }
      end
    end
  end
end
