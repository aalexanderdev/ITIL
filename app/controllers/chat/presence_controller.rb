module Chat
  class PresenceController < BaseController
    def handle
      action = requested_action || "heartbeat"

      case action
      when "heartbeat", "ping"
        ChatPresence.heartbeat_for(current_user)
        render json: { success: true }
      when "online_users"
        users = User.active.where.not(id: current_user.id)
                           .joins(:chat_presence)
                           .merge(ChatPresence.online)
                           .map { |u| { id: u.id, name: u.full_name } }
        render json: { users: users, online_users: users.map { |u| u[:id] } }
      when "offline"
        ChatPresence.set_offline_for(current_user)
        render json: { success: true }
      else
        render json: { success: true }
      end
    end
  end
end
