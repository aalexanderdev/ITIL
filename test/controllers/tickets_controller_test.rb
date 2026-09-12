require "test_helper"

class TicketsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
    @ticket = Ticket.create!(
      title: "Problema de red",
      description: "No conecta a wifi",
      urgency: 3,
      impact: 3,
      requester: @user
    )
  end

  test "redirects unauthenticated user to login" do
    get tickets_path
    assert_redirected_to new_session_path
  end

  test "authenticated user can view tickets index" do
    sign_in_as(@user)
    get tickets_path
    assert_response :success
  end

  test "authenticated user can create ticket" do
    sign_in_as(@user)
    assert_difference("Ticket.count", 1) do
      post tickets_path, params: {
        ticket: {
          title: "Nuevo error de software",
          description: "No abre Excel",
          ticket_type: "incident",
          urgency: 4,
          impact: 3
        }
      }
    end

    created_ticket = Ticket.last
    assert_redirected_to ticket_path(created_ticket)
    assert_equal @user.id, created_ticket.requester_id
  end

  test "staff can solve ticket" do
    sign_in_as(@admin)
    patch solve_ticket_path(@ticket), params: { solution_text: "Se reinició el router y se limpió caché" }

    assert_redirected_to ticket_path(@ticket)
    @ticket.reload
    assert_equal "solved", @ticket.status
    assert_equal 1, @ticket.ticket_updates.where(update_type: "solution").count
  end
end
