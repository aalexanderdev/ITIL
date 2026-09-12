require "test_helper"

class Chat::MessagesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
    @conv = ChatConversation.find_or_create_direct(@admin, @user)
  end

  test "sends a message in direct conversation" do
    sign_in_as(@user)

    assert_difference -> { @conv.chat_messages.count }, 1 do
      post "/chat/ajax/messages", params: {
        action: "send",
        conversation_id: @conv.id,
        content: "Hola Administrador!"
      }
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert json["id"].present?
  end

  test "lists messages with participants and reactions" do
    sign_in_as(@user)
    @conv.chat_messages.create!(user: @admin, content: "Mensaje previo")

    get "/chat/ajax/messages", params: {
      action: "list",
      conversation_id: @conv.id
    }

    assert_response :success
    json = JSON.parse(response.body)
    assert json["messages"].is_a?(Array)
    assert json["participants"].is_a?(Array)
    assert json["reactions"].is_a?(Hash)
  end

  test "toggles message emoji reaction" do
    sign_in_as(@user)
    msg = @conv.chat_messages.create!(user: @admin, content: "Genial")

    assert_difference -> { msg.chat_message_reactions.count }, 1 do
      post "/chat/ajax/messages", params: {
        action: "toggle_reaction",
        message_id: msg.id,
        emoji: "👍"
      }
    end
    assert_response :success

    # Toggling again removes it
    assert_difference -> { msg.chat_message_reactions.count }, -1 do
      post "/chat/ajax/messages", params: {
        action: "toggle_reaction",
        message_id: msg.id,
        emoji: "👍"
      }
    end
    assert_response :success
  end
end
