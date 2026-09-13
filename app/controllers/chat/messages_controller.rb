module Chat
  class MessagesController < BaseController
    def handle
      action = requested_action || "list"

      case action
      when "list"
        list_messages
      when "send"
        send_message
      when "mark_read"
        mark_read
      when "toggle_reaction"
        toggle_reaction
      when "typing"
        typing_indicator
      else
        list_messages
      end
    end

    private

    def set_conversation
      conv_id = (params[:conversation_id] || params[:id]).to_i
      if conv_id <= 0 && params[:message_id].present?
        conv_id = ChatMessage.find_by(id: params[:message_id])&.chat_conversation_id.to_i
      end

      @conv = ChatConversation.find_by(id: conv_id)
      unless @conv
        render json: { success: false, error: "Conversación no encontrada" }, status: :not_found
        return false
      end

      # Security access check
      @conv_user = @conv.chat_conversation_users.find_by(user_id: current_user.id)
      if !@conv_user && @conv.is_group? && @conv.department_id == current_user.department_id
        @conv_user = @conv.chat_conversation_users.create!(user: current_user)
      end

      unless @conv_user
        render json: { success: false, error: "Acceso denegado a la conversación" }, status: :forbidden
        return false
      end

      true
    end

    def list_messages
      return unless set_conversation

      since_id = params[:since_id].to_i
      query = @conv.chat_messages.includes(:user, :chat_message_reactions)

      messages = if since_id.positive?
        query.where("id > ?", since_id).order(id: :asc).limit(100)
      else
        # Initial load: last 50 messages
        query.order(id: :desc).limit(50).reverse
      end

      # Automatically update read marker
      @conv_user.mark_read!

      # Build participants data for read receipts (✓✓)
      participants = @conv.chat_conversation_users.includes(user: :chat_presence).map do |cu|
        u = cu.user
        {
          id: u.id,
          name: u.full_name,
          last_read: cu.last_read || 0,
          last_seen: u.chat_presence&.last_seen || 0
        }
      end

      # Check who is currently typing
      typing_names = @conv.chat_conversation_users.where.not(user_id: current_user.id)
                          .select(&:typing?)
                          .map { |cu| cu.user.full_name }

      # Build reactions map for entire conversation
      reactions_map = {}
      ChatMessageReaction.joins(:chat_message)
                         .where(chat_messages: { chat_conversation_id: @conv.id })
                         .includes(:user)
                         .each do |rx|
        reactions_map[rx.chat_message_id] ||= {}
        reactions_map[rx.chat_message_id][rx.emoji] ||= []
        reactions_map[rx.chat_message_id][rx.emoji] << rx.user.full_name
      end

      render json: {
        messages: messages.map { |m| m.as_chat_json(current_user) },
        participants: participants,
        mentionable_users: @conv.mentionable_users,
        reactions: reactions_map,
        ticket_conversions: {},
        typing_users: typing_names
      }
    end

    def send_message
      return unless set_conversation

      raw_header = request.headers["X-Chat-Content"] || request.headers["HTTP_X_CHAT_CONTENT"]
      content = if raw_header.present?
        begin
          URI.decode_uri_component(raw_header)
        rescue StandardError
          URI.decode_www_form_component(raw_header)
        end
      else
        params[:content]
      end

      content = content.to_s.strip

      if content.blank?
        return render json: { success: false, error: "empty_message" }, status: :bad_request
      end

      max_len = ChatSetting.current.max_message_length || 2000
      if content.length > max_len
        return render json: {
          success: false,
          error: "message_too_long",
          max_length: max_len,
          length: content.length
        }, status: :bad_request
      end

      msg = @conv.chat_messages.create!(
        user: current_user,
        content: content
      )

      # Update sender's read pointer & clear typing
      @conv_user.mark_read!
      @conv_user.clear_typing!
      @conv.touch

      render json: { success: true, id: msg.id }
    end

    def mark_read
      return unless set_conversation

      @conv_user.mark_read!
      render json: { success: true }
    end

    def toggle_reaction
      return unless set_conversation

      msg_id = (params[:message_id] || params[:id]).to_i
      msg = @conv.chat_messages.find_by(id: msg_id)
      unless msg
        return render json: { success: false, error: "message_not_found" }, status: :not_found
      end

      if msg.user_id == current_user.id
        return render json: { success: false, error: "cannot_react_to_own_message" }, status: :forbidden
      end

      emoji = params[:emoji].presence || "👍"
      existing = msg.chat_message_reactions.find_by(user_id: current_user.id, emoji: emoji)

      reacted = if existing
        existing.destroy
        false
      else
        msg.chat_message_reactions.create!(user: current_user, emoji: emoji)
        true
      end

      render json: { success: true, reacted: reacted }
    end

    def typing_indicator
      return unless set_conversation

      if params[:status] == "stop"
        @conv_user.clear_typing!
      else
        @conv_user.touch_typing!
      end

      render json: { success: true }
    end
  end
end
