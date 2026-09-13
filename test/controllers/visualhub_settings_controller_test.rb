require "test_helper"

class VisualhubSettingsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
  end

  test "unauthenticated user cannot access visualhub settings" do
    get edit_visualhub_settings_path
    assert_redirected_to new_session_path
  end

  test "non-admin user cannot access visualhub settings" do
    sign_in_as(@user)

    get edit_visualhub_settings_path
    assert_redirected_to root_path

    patch visualhub_settings_path, params: { visualhub_setting: { app_name: "Hacked" } }
    assert_redirected_to root_path
  end

  test "admin can view visualhub settings form" do
    sign_in_as(@admin)
    get edit_visualhub_settings_path
    assert_response :success
    assert_select "h1", "Configuración de VisualHub & Accesibilidad"
  end

  test "admin can update visualhub settings" do
    sign_in_as(@admin)

    patch visualhub_settings_path, params: {
      visualhub_setting: {
        app_name: "OpenITIL Enterprise",
        primary_color: "#10b981",
        accent_color: "#059669",
        widget_position: "bottom-left",
        tts_speed: 1.25,
        point_to_read: true
      }
    }

    assert_redirected_to edit_visualhub_settings_path
    follow_redirect!
    assert_match "actualizada con éxito", response.body

    setting = VisualhubSetting.current.reload
    assert_equal "OpenITIL Enterprise", setting.app_name
    assert_equal "#10b981", setting.primary_color
    assert_equal "#059669", setting.accent_color
    assert_equal "bottom-left", setting.widget_position
    assert_equal 1.25, setting.tts_speed
    assert setting.point_to_read?
  end
end
