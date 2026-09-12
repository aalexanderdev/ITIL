class DashboardController < ApplicationController
  def index
    @total_tickets = Ticket.count
    @open_tickets = Ticket.open_tickets.count
    @solved_tickets = Ticket.where(status: %w[solved closed]).count
    @critical_tickets = Ticket.open_tickets.where(priority: [ 5, 6 ]).count
    @total_assets = Asset.count

    if current_user.staff?
      @recent_tickets = Ticket.recent.includes(:requester, :assigned_to, :ticket_category, :asset).limit(8)
      @my_tickets = Ticket.assigned_to_user(current_user.id).open_tickets.recent.limit(5)
    else
      @recent_tickets = current_user.requested_tickets.recent.includes(:assigned_to, :ticket_category, :asset).limit(8)
      @my_tickets = @recent_tickets
    end

    @recent_assets = Asset.recent.includes(:user, :department, :location).limit(5)
    @assets_by_status = Asset.group(:status).count
    @tickets_by_status = Ticket.group(:status).count
    @tickets_by_priority = Ticket.open_tickets.group(:priority).count
  end
end
