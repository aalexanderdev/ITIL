require "test_helper"

class Chat::ConfigControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "unauthenticated config request is unauthorized" do
    get "/chat/ajax/config"
    assert_response :unauthorized
  end

  test "authenticated user can get config via chat ajax api" do
    sign_in_as(@user)
    get "/chat/ajax/config", params: { action: "get" }
    assert_response :success

    json = JSON.parse(response.body)
    assert_equal 380, json["panel_width_px"]
    assert_equal "#4f46e5", json["bubble_color"]
    assert_equal true, json["presence_enabled"]
  end

  test "non-admin cannot update config via chat ajax api" do
    sign_in_as(@user)
    post "/chat/ajax/config", params: { action: "update", bubble_color: "#ef4444" }
    assert_response :forbidden
  end

  test "admin can update config via chat ajax api" do
    sign_in_as(@admin)
    post "/chat/ajax/config", params: { action: "update", bubble_color: "#ef4444" }
    assert_response :success

    json = JSON.parse(response.body)
    assert_equal true, json["success"]
    assert_equal "#ef4444", ChatSetting.current.reload.bubble_color
  end
end
