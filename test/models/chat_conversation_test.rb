require "test_helper"

class ChatConversationTest < ActiveSupport::TestCase
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "find_or_create_direct creates a private thread between two users" do
    conv1 = ChatConversation.find_or_create_direct(@admin, @user)
    assert_not_nil conv1
    assert_not conv1.is_group?
    assert_not conv1.is_self?
    assert_equal 2, conv1.users.count

    # Calling again returns the exact same conversation
    conv2 = ChatConversation.find_or_create_direct(@user, @admin)
    assert_equal conv1.id, conv2.id
  end

  test "find_or_create_self creates a personal notification thread" do
    self_conv = ChatConversation.find_or_create_self(@user)
    assert self_conv.is_self?
    assert_equal "Notificaciones del Sistema", self_conv.name
    assert_equal 1, self_conv.users.count
    assert_equal @user.id, self_conv.users.first.id
  end

  test "sending a system notice creates a message in the self thread" do
    assert_difference -> { @user.self_chat_conversation.chat_messages.count }, 1 do
      @user.send_system_chat_notice("Aviso de prueba", "/tickets/1")
    end

    last_msg = @user.self_chat_conversation.last_message
    assert_equal "Aviso de prueba", last_msg.content
    assert_equal "/tickets/1", last_msg.link_url
  end

  test "ticket assignment sends chat notice to technician" do
    ticket = Ticket.create!(
      requester: @user,
      title: "Problema con impresora",
      description: "No imprime en red",
      ticket_type: "incident",
      urgency: 3,
      impact: 3
    )

    assert_difference -> { @admin.self_chat_conversation.chat_messages.count }, 1 do
      ticket.update!(assigned_to: @admin)
    end
    msg = @admin.self_chat_conversation.last_message
    assert_includes msg.content, "Asignación"
  end

  test "ticket update comment sends chat notice to requester" do
    ticket = Ticket.create!(
      requester: @user,
      assigned_to: @admin,
      title: "Fallo de correo",
      description: "No recibe correos",
      ticket_type: "incident",
      urgency: 3,
      impact: 3
    )

    assert_difference -> { @user.self_chat_conversation.chat_messages.count }, 1 do
      ticket.ticket_updates.create!(
        user: @admin,
        content: "Estamos revisando su solicitud.",
        update_type: "comment"
      )
    end
    msg = @user.self_chat_conversation.last_message
    assert_includes msg.content, "Nuevo seguimiento"
  end
end
