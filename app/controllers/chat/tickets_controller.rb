module Chat
  class TicketsController < BaseController
    def handle
      action = requested_action || "convert"

      case action
      when "convert"
        convert_message
      else
        render json: { success: false, error: "Acción no soportada" }, status: :bad_request
      end
    end

    private

    def convert_message
      unless current_user.staff?
        return render json: { success: false, error: "Solo el personal técnico puede convertir mensajes a tickets" }, status: :forbidden
      end

      msg = ChatMessage.find_by(id: params[:message_id])
      unless msg
        return render json: { success: false, error: "Mensaje no encontrado" }, status: :not_found
      end

      category_id = params[:itilcategories_id] || params[:category_id]
      redirect_url = "/tickets/new?title=#{CGI.escape('Ticket desde Chat: ' + msg.content.truncate(40))}&description=#{CGI.escape(msg.content)}"
      redirect_url += "&ticket_category_id=#{category_id}" if category_id.present?

      render json: {
        success: true,
        redirect_url: redirect_url
      }
    end
  end
end
