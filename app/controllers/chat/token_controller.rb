module Chat
  class TokenController < BaseController
    def show
      session[:_chat_csrf] ||= SecureRandom.hex(16)

      # Ensure user has presence record and self thread
      ChatPresence.heartbeat_for(current_user)
      ChatConversation.find_or_create_self(current_user)
      ChatConversation.sync_department_conversations if current_user.department_id

      setting = ChatSetting.current

      render json: {
        csrf_token: session[:_chat_csrf],
        users_id: current_user.id,
        own_name: current_user.full_name,
        shortcut_buttons: setting.parsed_shortcut_buttons,
        reactions_enabled: setting.reactions_enabled,
        presence_enabled: setting.presence_enabled,
        typing_indicator_enabled: setting.typing_indicator_enabled,
        notification_sound_enabled: setting.notification_sound_enabled,
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
        emoji_enabled: false, # Clean native experience without external vendor blob
        attachment_enabled: false,
        ticket_conversion: {
          can_convert: current_user.staff? && setting.ticket_conversion_enabled,
          on_received: setting.ticket_conversion_on_received,
          on_sent: setting.ticket_conversion_on_sent,
          requester_mode: setting.ticket_conversion_requester,
          categories: TicketCategory.all.map { |c| { id: c.id, name: c.name } }
        },
        i18n: {
          chat: "Chat de Soporte",
          online: "En línea",
          featured: "Destacados",
          groups: "Salas y Departamentos",
          private: "Conversaciones Directas",
          notifications: "Notificaciones",
          search_conversations: "Buscar conversaciones...",
          search_users: "Buscar personas...",
          no_online_users: "No hay otros usuarios conectados",
          no_featured: "No hay conversaciones destacadas",
          no_groups: "No hay salas grupales",
          no_private: "No hay conversaciones privadas",
          no_conversations: "Sin conversaciones activas",
          type_message: "Escribe un mensaje...",
          send: "Enviar",
          emojis: "Emojis",
          back: "Volver",
          new_chat: "Nueva conversación",
          star_conversation: "Destacar conversación",
          unstar_conversation: "Quitar de destacados",
          pin_panel: "Fijar panel a la derecha",
          unpin_panel: "Desfijar panel",
          shortcuts_hint: "Ctrl + Alt + ? → Mostrar atajos",
          shortcuts_title: "Atajos de teclado",
          close: "Cerrar",
          shortcut_single: "Acceso directo",
          shortcut_multi: "Accesos directos",
          convert_to_ticket: "Convertir en ticket",
          already_converted: "Ya convertido → Ticket #",
          ticket_generated_from_chat: "Ticket generado desde el chat",
          select_category: "Seleccionar categoría...",
          without_category: "Sin categoría",
          no_info_yet: "Sin información todavía",
          read_by: "Leído por",
          not_read_by: "No leído por",
          delivered_to: "Entregado (no leído)",
          sent_to: "Enviado",
          reacted_by: "Reaccionado por"
        }
      }
    end
  end
end
