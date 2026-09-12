require "test_helper"

class TicketTest < ActiveSupport::TestCase
  setup do
    @requester = users(:user)
    @tech = users(:tech)
  end

  test "calculates ITIL priority correctly based on urgency and impact" do
    # Urgencia 5 (Muy alta), Impacto 5 (Muy alto) -> Prioridad 6 (Mayor / Crítica)
    t_critical = Ticket.create!(
      title: "Caída total datacenter",
      description: "Servidores sin respuesta",
      urgency: 5,
      impact: 5,
      requester: @requester
    )
    assert_equal 6, t_critical.priority
    assert_equal "Mayor / Crítica", t_critical.priority_name

    # Urgencia 1, Impacto 1 -> Prioridad 1 (Muy baja)
    t_low = Ticket.create!(
      title: "Consulta sobre fondo de pantalla",
      description: "Duda menor",
      urgency: 1,
      impact: 1,
      requester: @requester
    )
    assert_equal 1, t_low.priority
    assert_equal "Muy baja", t_low.priority_name
  end

  test "auto generates ticket_number with correct prefix" do
    ticket = Ticket.create!(
      ticket_type: "incident",
      title: "Teclado roto",
      description: "Tecla espacio atascada",
      requester: @requester
    )
    assert_match(/^INC-/, ticket.ticket_number)

    req = Ticket.create!(
      ticket_type: "request",
      title: "Solicitud de mouse",
      description: "Mouse ergonómico",
      requester: @requester
    )
    assert_match(/^REQ-/, req.ticket_number)
  end

  test "calculates SLA due date based on priority" do
    ticket = Ticket.create!(
      title: "Problema prioritario",
      description: "Detalle",
      urgency: 5,
      impact: 5,
      requester: @requester
    )
    assert_not_nil ticket.due_at
    assert ticket.due_at > Time.current
  end
end
