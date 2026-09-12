require "test_helper"

class Chat::TicketsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
    @conv = ChatConversation.find_or_create_direct(@admin, @user)
    @msg = @conv.chat_messages.create!(user: @user, content: "Necesito apoyo urgente con VPN")
  end

  test "non-staff user cannot convert chat message to ticket" do
    sign_in_as(@user)
    post "/chat/ajax/tickets", params: { action: "convert", message_id: @msg.id }
    assert_response :forbidden
  end

  test "staff member can convert chat message into ticket pre-fill URL" do
    sign_in_as(@admin)
    post "/chat/ajax/tickets", params: { action: "convert", message_id: @msg.id }
    assert_response :success

    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert_includes json["redirect_url"], "/tickets/new?"
    assert_includes json["redirect_url"], "VPN"
  end
end
