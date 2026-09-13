require "test_helper"

class Chat::ConversationsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "lists conversations divided into featured, group and private" do
    sign_in_as(@user)
    get "/chat/ajax/conversations", params: { action: "list" }
    assert_response :success

    json = JSON.parse(response.body)
    assert json["featured"].is_a?(Array)
    assert json["group"].is_a?(Array)
    assert json["private"].is_a?(Array)
    assert json["conversations"].is_a?(Array)
    assert json["users"].is_a?(Array)
  end

  test "creates and finds private conversation using target_id" do
    sign_in_as(@user)

    # Initially none
    get "/chat/ajax/conversations", params: { action: "find_private", target_id: @admin.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal false, json["exists"]
    assert_nil json["id"]

    # Create private conversation via target_id
    post "/chat/ajax/conversations", params: { action: "create_private", target_id: @admin.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    conv_id = json["id"]
    assert_not_nil conv_id

    # Now find returns it with id
    get "/chat/ajax/conversations", params: { action: "find_private", target_id: @admin.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["exists"]
    assert_equal conv_id, json["id"]
  end

  test "toggles featured state of conversation" do
    sign_in_as(@user)
    conv = ChatConversation.find_or_create_direct(@user, @admin)

    post "/chat/ajax/conversations", params: { action: "toggle_featured", conversation_id: conv.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert_equal true, json["featured"]

    # Toggle off
    post "/chat/ajax/conversations", params: { action: "toggle_featured", conversation_id: conv.id }
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert_equal false, json["featured"]
  end

  test "searches users by term" do
    sign_in_as(@user)
    get "/chat/ajax/conversations", params: { action: "search_users", term: "admin" }
    assert_response :success

    json = JSON.parse(response.body)
    assert json["users"].any? { |u| u["id"] == @admin.id }
  end
end
