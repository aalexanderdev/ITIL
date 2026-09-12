module Chat
  class TokenController < BaseController
    def show
      session[:_chat_csrf] ||= SecureRandom.hex(16)

      # Ensure user has presence record and self thread
      ChatPresence.heartbeat_for(current_user)
      ChatConversation.find_or_create_self(current_user)
      ChatConversation.sync_department_conversations if current_user.department_id

      render json: {
        csrf_token: session[:_chat_csrf],
        users_id: current_user.id,
        own_name: current_user.full_name,
        shortcut_buttons: [
          { label: "Helpdesk", url: "/tickets" },
          { label: "Inventario CMDB", url: "/assets" },
          { label: "Base Conocimiento", url: "/kb_articles" }
        ],
        reactions_enabled: true,
        presence_enabled: true,
        typing_indicator_enabled: true,
        notification_sound_enabled: true,
        panel_width_px: 380,
        bubble_color: "#4f46e5",
        mention_color: "#4338ca",
        launcher_color: "#4f46e5",
        font_size: "normal",
        poll_messages_ms: 2000,
        poll_conversations_ms: 10000,
        poll_online_users_ms: 30000,
        poll_presence_ms: 30000,
        max_message_length: 2000,
        emoji_enabled: false, # Clean native experience without external vendor blob
        attachment_enabled: false,
        ticket_conversion: {
          can_convert: current_user.staff?,
          on_received: true,
          on_sent: false,
          requester_mode: "converter",
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
