class TicketUpdatesController < ApplicationController
  before_action :set_ticket

  def create
    @update = @ticket.ticket_updates.new(ticket_update_params)
    @update.user = current_user

    # End users cannot create private notes or technical tasks
    if current_user.end_user? && @update.update_type != "comment"
      @update.update_type = "comment"
    end

    if @update.save
      # If adding a solution, optionally update ticket status to solved
      if @update.solution? && current_user.staff?
        @ticket.update(status: "solved", resolved_at: Time.current)
      end

      redirect_to @ticket, notice: "Actualización agregada al ticket."
    else
      redirect_to @ticket, alert: "No se pudo agregar la actualización: #{@update.errors.full_messages.join(', ')}"
    end
  end

  def destroy
    require_admin!
    @update = @ticket.ticket_updates.find(params[:id])
    @update.destroy
    redirect_to @ticket, notice: "Actualización eliminada."
  end

  private

  def set_ticket
    @ticket = Ticket.find(params[:ticket_id])
    if current_user.end_user? && @ticket.requester_id != current_user.id
      redirect_to tickets_path, alert: "No tienes permiso para actualizar este ticket."
    end
  end

  def ticket_update_params
    params.require(:ticket_update).permit(:content, :update_type, :time_spent_minutes, :solution_status)
  end
end
