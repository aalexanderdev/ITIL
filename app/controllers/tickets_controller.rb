class TicketsController < ApplicationController
  before_action :set_ticket, only: %i[show edit update destroy solve close reopen assign_to_me]
  before_action :require_staff!, only: %i[edit update destroy]

  def index
    @tickets = Ticket.includes(:requester, :assigned_to, :ticket_category, :asset).recent

    # Role-based scoping: normal users only see their tickets
    unless current_user.staff?
      @tickets = @tickets.where(requester_id: current_user.id)
    end

    # Filters
    if params[:status].present?
      @tickets = @tickets.where(status: params[:status])
    end

    if params[:priority].present?
      @tickets = @tickets.where(priority: params[:priority])
    end

    if params[:ticket_type].present?
      @tickets = @tickets.where(ticket_type: params[:ticket_type])
    end

    if params[:category_id].present?
      @tickets = @tickets.where(ticket_category_id: params[:category_id])
    end

    if params[:query].present?
      q = "%#{params[:query]}%"
      @tickets = @tickets.where("title LIKE ? OR description LIKE ? OR ticket_number LIKE ?", q, q, q)
    end
  end

  def show
    @ticket_updates = @ticket.ticket_updates.includes(:user).recent
    unless current_user.staff?
      @ticket_updates = @ticket_updates.public_updates
    end
    @new_update = TicketUpdate.new
  end

  def new
    initial_attrs = { ticket_type: params[:ticket_type] || "incident", urgency: 3, impact: 3 }
    if params[:ticket].present?
      initial_attrs.merge!(params.require(:ticket).permit(:title, :description, :ticket_category_id, :asset_id, :ticket_type))
    end
    @ticket = Ticket.new(initial_attrs)
    @ticket.asset_id = params[:asset_id] if params[:asset_id].present?
  end


  def create
    @ticket = Ticket.new(ticket_params)
    @ticket.requester = current_user

    if @ticket.save
      redirect_to @ticket, notice: "Ticket #{@ticket.ticket_number} creado con éxito."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @ticket.update(ticket_params)
      redirect_to @ticket, notice: "Ticket #{@ticket.ticket_number} actualizado correctamente."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    require_admin!
    @ticket.destroy
    redirect_to tickets_path, notice: "Ticket eliminado."
  end

  # Workflow actions
  def solve
    @ticket.update(status: "solved", resolved_at: Time.current)
    if params[:solution_text].present?
      @ticket.ticket_updates.create!(
        user: current_user,
        update_type: "solution",
        content: params[:solution_text],
        solution_status: "approved"
      )
    end
    redirect_to @ticket, notice: "El ticket ha sido marcado como Resuelto."
  end

  def close
    @ticket.update(status: "closed", closed_at: Time.current)
    redirect_to @ticket, notice: "El ticket ha sido cerrado formalmente."
  end

  def reopen
    @ticket.update(status: "in_progress", resolved_at: nil, closed_at: nil)
    @ticket.ticket_updates.create!(
      user: current_user,
      update_type: "comment",
      content: "Ticket reabierto: #{params[:reason].presence || 'Reapertura por solicitud del usuario o técnico.'}"
    )
    redirect_to @ticket, notice: "Ticket reabierto y en curso."
  end

  def assign_to_me
    @ticket.update(assigned_to: current_user, status: "in_progress")
    @ticket.ticket_updates.create!(
      user: current_user,
      update_type: "comment",
      content: "Ticket asignado a #{current_user.full_name} y puesto en curso."
    )
    redirect_to @ticket, notice: "Te has asignado este ticket."
  end

  private

  def set_ticket
    @ticket = Ticket.find(params[:id])
    # Security check: End users can only see their own tickets
    if current_user.end_user? && @ticket.requester_id != current_user.id
      redirect_to tickets_path, alert: "No tienes permiso para ver este ticket."
    end
  end

  def ticket_params
    permitted = %i[ticket_type title description urgency impact ticket_category_id asset_id]
    permitted += %i[status assigned_to_id due_at] if current_user.staff?
    params.require(:ticket).permit(permitted)
  end
end
