require "test_helper"

class Chat::TokenControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:user)
  end

  test "unauthenticated token request is unauthorized" do
    get "/chat/ajax/token"
    assert_response :unauthorized
  end

  test "authenticated token request returns chat bootstrap configuration" do
    sign_in_as(@user)
    get "/chat/ajax/token"
    assert_response :success

    json = JSON.parse(response.body)
    assert_equal @user.id, json["users_id"]
    assert json["csrf_token"].present?
    assert json["i18n"].is_a?(Hash)
    assert_equal true, json["presence_enabled"]
  end
end
