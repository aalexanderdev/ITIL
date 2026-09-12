module Chat
  class ConversationsController < BaseController
    def handle
      action = requested_action || "list"

      case action
      when "list"
        list_conversations
      when "find_private"
        find_private_conversation
      when "create_private"
        create_private_conversation
      when "toggle_featured"
        toggle_featured_conversation
      when "search_users"
        search_users
      else
        list_conversations
      end
    end

    private

    def list_conversations
      # Find all conversations the user is a participant of
      conv_users = current_user.chat_conversation_users.includes(:chat_conversation)
      conversations = []

      conv_users.each do |cu|
        conv = cu.chat_conversation
        next unless conv

        # A private conversation must have at least 1 message or be self to appear in active list
        last_msg = conv.last_message
        next if !conv.is_group? && !conv.is_self? && last_msg.nil?

        other = conv.other_user_for(current_user)

        conversations << {
          id: conv.id,
          name: conv.display_name_for(current_user),
          is_group: conv.is_group? ? 1 : 0,
          is_self: conv.is_self? ? 1 : 0,
          is_featured: cu.is_featured? ? 1 : 0,
          unread: conv.unread_count_for(current_user),
          last_message: last_msg&.content,
          last_message_date: last_msg&.created_at&.to_i,
          other_user_id: other&.id
        }
      end

      # All users for contact list / direct chat initiation
      users_list = User.active.where.not(id: current_user.id).map do |u|
        {
          id: u.id,
          name: u.full_name,
          online: u.online?
        }
      end

      render json: {
        conversations: conversations,
        users: users_list
      }
    end

    def find_private_conversation
      target_user = User.find_by(id: params[:target_user_id])
      return render json: { exists: false } unless target_user

      # Search for existing direct conversation
      common_conv_id = ChatConversationUser.where(user_id: current_user.id)
                                           .joins(:chat_conversation)
                                           .where(chat_conversations: { is_group: false, is_self: false })
                                           .where(chat_conversation_id: ChatConversationUser.where(user_id: target_user.id).select(:chat_conversation_id))
                                           .pick(:chat_conversation_id)

      if common_conv_id
        render json: { exists: true, conversation_id: common_conv_id }
      else
        render json: { exists: false }
      end
    end

    def create_private_conversation
      target_user = User.find_by(id: params[:target_user_id])
      unless target_user
        return render json: { success: false, error: "Usuario no encontrado" }, status: :not_found
      end

      conv = ChatConversation.find_or_create_direct(current_user, target_user)
      render json: { success: true, conversation_id: conv.id }
    end

    def toggle_featured_conversation
      conv_user = current_user.chat_conversation_users.find_by(chat_conversation_id: params[:conversation_id])
      if conv_user
        conv_user.update!(is_featured: !conv_user.is_featured)
        render json: { success: true, is_featured: conv_user.is_featured ? 1 : 0 }
      else
        render json: { success: false, error: "Conversación no encontrada" }, status: :not_found
      end
    end

    def search_users
      q = "%#{params[:query]}%"
      matching_users = User.active.where.not(id: current_user.id)
                                  .where("first_name LIKE ? OR last_name LIKE ? OR email_address LIKE ?", q, q, q)
                                  .limit(15)

      render json: {
        users: matching_users.map { |u| { id: u.id, name: u.full_name, online: u.online? } }
      }
    end
  end
end
