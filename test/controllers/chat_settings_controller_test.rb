require "test_helper"

class ChatSettingsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "non-admin users cannot access chat settings" do
    sign_in_as(@user)

    get edit_chat_settings_path
    assert_redirected_to root_path

    patch chat_settings_path, params: { chat_setting: { panel_width_px: 500 } }
    assert_redirected_to root_path
  end

  test "admin can view chat settings form" do
    sign_in_as(@admin)
    get edit_chat_settings_path
    assert_response :success
    assert_select "h1", "Configuración de HelpdeskChat"
  end

  test "admin can update chat settings and changes reflect in token API" do
    sign_in_as(@admin)

    patch chat_settings_path, params: {
      chat_setting: {
        panel_width_px: 400,
        bubble_color: "#10b981",
        launcher_color: "#059669",
        font_size: 16,
        poll_messages_ms: 3500,
        reactions_enabled: false
      }
    }

    assert_redirected_to edit_chat_settings_path
    follow_redirect!
    assert_match "actualizada exitosamente", response.body

    setting = ChatSetting.current.reload
    assert_equal 400, setting.panel_width_px
    assert_equal "#10b981", setting.bubble_color
    assert_equal "#059669", setting.launcher_color
    assert_equal 16, setting.font_size
    assert_equal 3500, setting.poll_messages_ms
    assert_equal false, setting.reactions_enabled

    # Verify that the chat token bootstrap returns these updated values
    get "/chat/ajax/token"
    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 400, json["panel_width_px"]
    assert_equal "#10b981", json["bubble_color"]
    assert_equal "#059669", json["launcher_color"]
    assert_equal 16, json["font_size"]
    assert_equal 3500, json["poll_messages_ms"]
    assert_equal false, json["reactions_enabled"]
  end
end
