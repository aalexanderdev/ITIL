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
      @conv = ChatConversation.find_by(id: params[:conversation_id])
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

      if since_id > 0
        messages = query.where("id > ?", since_id).order(id: :asc).limit(100)
      else
        # Initial load: last 50 messages
        messages = query.order(id: :desc).limit(50).reverse
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

      raw_content = params[:content] || request.headers["X-Chat-Content"]
      raw_content = URI.decode_www_form_component(raw_content) if raw_content && request.headers["X-Chat-Content"]

      if raw_content.blank?
        return render json: { success: false, error: "El mensaje no puede estar vacío" }, status: :unprocessable_entity
      end

      msg = @conv.chat_messages.create!(
        user: current_user,
        content: raw_content.strip
      )

      # Update sender's read pointer
      @conv_user.mark_read!

      render json: { success: true, id: msg.id }
    end

    def mark_read
      return unless set_conversation

      @conv_user.mark_read!
      render json: { success: true }
    end

    def toggle_reaction
      msg = ChatMessage.find_by(id: params[:message_id])
      unless msg
        return render json: { success: false, error: "Mensaje no encontrado" }, status: :not_found
      end

      emoji = params[:emoji].presence || "👍"
      existing = msg.chat_message_reactions.find_by(user_id: current_user.id, emoji: emoji)

      if existing
        existing.destroy
      else
        msg.chat_message_reactions.create!(user: current_user, emoji: emoji)
      end

      render json: { success: true }
    end

    def typing_indicator
      return unless set_conversation

      @conv_user.touch_typing!
      render json: { success: true }
    end
  end
end
