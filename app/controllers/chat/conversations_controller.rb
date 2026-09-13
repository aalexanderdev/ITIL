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
      conv_users = current_user.chat_conversation_users.includes(chat_conversation: %i[department users chat_messages])
      featured_list = []
      group_list = []
      private_list = []
      all_conversations = []

      conv_users.each do |cu|
        conv = cu.chat_conversation
        next unless conv

        # A private conversation must have at least 1 message or be self to appear in active list
        last_msg = conv.last_message
        next if !conv.is_group? && !conv.is_self? && last_msg.nil?

        other = conv.other_user_for(current_user)

        entry = {
          id: conv.id,
          name: conv.display_name_for(current_user),
          unread: conv.unread_count_for(current_user),
          featured: cu.is_featured?,
          is_group: conv.is_group?,
          is_self: conv.is_self?
        }
        entry[:mentioned] = false if conv.is_group?

        if cu.is_featured?
          featured_list << entry
        elsif conv.is_group?
          group_list << entry
        else
          private_list << entry
        end

        all_conversations << entry.merge(
          is_featured: cu.is_featured? ? 1 : 0,
          last_message: last_msg&.content,
          last_message_date: last_msg&.created_at&.to_i,
          other_user_id: other&.id
        )
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
        featured: featured_list,
        group: group_list,
        private: private_list,
        conversations: all_conversations,
        users: users_list
      }
    end

    def find_private_conversation
      target_id = (params[:target_id] || params[:target_user_id]).to_i
      target_user = User.active.find_by(id: target_id)

      if target_id <= 0 || target_user.nil? || target_id == current_user.id
        return render json: { id: nil, exists: false, error: "invalid_target" }, status: :bad_request
      end

      # Search for existing direct conversation
      common_conv_id = ChatConversationUser.where(user_id: current_user.id)
                                           .joins(:chat_conversation)
                                           .where(chat_conversations: { is_group: false, is_self: false })
                                           .where(chat_conversation_id: ChatConversationUser.where(user_id: target_user.id).select(:chat_conversation_id))
                                           .pick(:chat_conversation_id)

      if common_conv_id
        render json: { id: common_conv_id, exists: true, conversation_id: common_conv_id }
      else
        render json: { id: nil, exists: false, conversation_id: nil }
      end
    end

    def create_private_conversation
      target_id = (params[:target_id] || params[:target_user_id]).to_i
      target_user = User.active.find_by(id: target_id)

      unless target_user
        return render json: { success: false, error: "Usuario no encontrado" }, status: :not_found
      end

      conv = ChatConversation.find_or_create_direct(current_user, target_user)
      render json: { success: true, id: conv.id, conversation_id: conv.id }
    end

    def toggle_featured_conversation
      conv_id = (params[:conversation_id] || params[:id]).to_i
      conv_user = current_user.chat_conversation_users.find_by(chat_conversation_id: conv_id)

      if conv_user
        new_val = !conv_user.is_featured?
        conv_user.update!(is_featured: new_val)
        render json: { success: true, featured: new_val, is_featured: new_val ? 1 : 0 }
      else
        render json: { success: false, error: "Conversación no encontrada" }, status: :not_found
      end
    end

    def search_users
      term = (params[:term].presence || params[:query].presence || "").to_s.strip
      matching_users = if term.blank?
        User.active.where.not(id: current_user.id).limit(15)
      else
        q = "%#{term}%"
        User.active.where.not(id: current_user.id)
                   .where("first_name LIKE ? OR last_name LIKE ? OR email_address LIKE ?", q, q, q)
                   .limit(15)
      end

      render json: {
        users: matching_users.map { |u| { id: u.id, name: u.full_name, online: u.online? } }
      }
    end
  end
end
