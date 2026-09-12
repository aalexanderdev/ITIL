require "test_helper"

class Chat::PresenceControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:user)
  end

  test "heartbeat updates user presence" do
    sign_in_as(@user)

    post "/chat/ajax/presence", params: { action: "heartbeat" }
    assert_response :success

    presence = ChatPresence.find_by(user_id: @user.id)
    assert_not_nil presence
    assert_equal "online", presence.status
    assert presence.online?
  end

  test "returns online users" do
    sign_in_as(@user)
    ChatPresence.heartbeat_for(@user)

    get "/chat/ajax/presence", params: { action: "online_users" }
    assert_response :success

    json = JSON.parse(response.body)
    assert_includes json["users"], @user.id
  end
end
