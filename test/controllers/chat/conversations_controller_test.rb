require "test_helper"

class Chat::ConversationsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "lists conversations and active users" do
    sign_in_as(@user)
    get "/chat/ajax/conversations", params: { action: "list" }
    assert_response :success

    json = JSON.parse(response.body)
    assert json["conversations"].is_a?(Array)
    assert json["users"].is_a?(Array)
  end

  test "creates and finds private conversation" do
    sign_in_as(@user)

    # Initially none
    get "/chat/ajax/conversations", params: { action: "find_private", target_user_id: @admin.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal false, json["exists"]

    # Create private conversation
    post "/chat/ajax/conversations", params: { action: "create_private", target_user_id: @admin.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    conv_id = json["conversation_id"]
    assert_not_nil conv_id

    # Now find returns it
    get "/chat/ajax/conversations", params: { action: "find_private", target_user_id: @admin.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["exists"]
    assert_equal conv_id, json["conversation_id"]
  end

  test "searches users by name or email" do
    sign_in_as(@user)
    get "/chat/ajax/conversations", params: { action: "search_users", query: "admin" }
    assert_response :success

    json = JSON.parse(response.body)
    assert json["users"].any? { |u| u["id"] == @admin.id }
  end
end
