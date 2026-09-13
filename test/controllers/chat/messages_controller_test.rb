require "test_helper"

class Chat::MessagesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
    @conv = ChatConversation.find_or_create_direct(@admin, @user)
  end

  test "sends a message via X-Chat-Content header" do
    sign_in_as(@user)

    content = "Hola administrador desde el chat!"
    assert_difference -> { @conv.chat_messages.count }, 1 do
      get "/chat/ajax/messages.php",
          params: { action: "send", conversation_id: @conv.id },
          headers: { "X-Chat-Content" => URI.encode_uri_component(content) }
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert json["id"].present?

    created_msg = ChatMessage.find(json["id"])
    assert_equal content, created_msg.content
    assert_equal @user.id, created_msg.user_id
  end

  test "sends a message via POST params content" do
    sign_in_as(@user)

    assert_difference -> { @conv.chat_messages.count }, 1 do
      post "/chat/ajax/messages", params: {
        action: "send",
        conversation_id: @conv.id,
        content: "Hola por POST!"
      }
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert json["id"].present?
  end

  test "rejects empty messages" do
    sign_in_as(@user)

    assert_no_difference -> { @conv.chat_messages.count } do
      get "/chat/ajax/messages.php",
          params: { action: "send", conversation_id: @conv.id },
          headers: { "X-Chat-Content" => URI.encode_uri_component("   ") }
    end

    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_equal false, json["success"]
    assert_equal "empty_message", json["error"]
  end

  test "lists messages with participants, mine flag and timestamp" do
    sign_in_as(@user)
    msg = @conv.chat_messages.create!(user: @admin, content: "Mensaje previo")

    get "/chat/ajax/messages", params: {
      action: "list",
      conversation_id: @conv.id
    }

    assert_response :success
    json = JSON.parse(response.body)
    assert json["messages"].is_a?(Array)
    first_msg = json["messages"].find { |m| m["id"] == msg.id }
    assert_not_nil first_msg
    assert_equal false, first_msg["mine"]
    assert_equal msg.created_at.to_i, first_msg["date"]
    assert_equal @admin.full_name, first_msg["author"]
    assert json["participants"].is_a?(Array)
    assert json["reactions"].is_a?(Hash)
  end

  test "toggles message emoji reaction" do
    sign_in_as(@user)
    msg = @conv.chat_messages.create!(user: @admin, content: "Genial")

    assert_difference -> { msg.chat_message_reactions.count }, 1 do
      post "/chat/ajax/messages", params: {
        action: "toggle_reaction",
        conversation_id: @conv.id,
        message_id: msg.id,
        emoji: "👍"
      }
    end
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert_equal true, json["reacted"]

    # Toggling again removes it
    assert_difference -> { msg.chat_message_reactions.count }, -1 do
      post "/chat/ajax/messages", params: {
        action: "toggle_reaction",
        conversation_id: @conv.id,
        message_id: msg.id,
        emoji: "👍"
      }
    end
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert_equal false, json["reacted"]
  end

  test "typing indicator updates and clears typing status" do
    sign_in_as(@user)
    cu = @conv.chat_conversation_users.find_by(user_id: @user.id)

    get "/chat/ajax/messages.php", params: {
      action: "typing",
      conversation_id: @conv.id
    }
    assert_response :success
    assert cu.reload.typing?

    get "/chat/ajax/messages.php", params: {
      action: "typing",
      conversation_id: @conv.id,
      status: "stop"
    }
    assert_response :success
    assert_not cu.reload.typing?
  end
end
