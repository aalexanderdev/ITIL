require "test_helper"

class VisualhubSettingTest < ActiveSupport::TestCase
  test "VisualhubSetting.current returns or creates the singleton record" do
    setting = VisualhubSetting.current
    assert_not_nil setting
    assert_equal "OpenITIL", setting.app_name
    assert_equal "#4f46e5", setting.primary_color
    assert_equal "#06b6d4", setting.accent_color
    assert setting.accessibility_enabled?
  end

  test "validates hex colors properly" do
    setting = VisualhubSetting.current
    setting.primary_color = "invalid-color"
    assert_not setting.valid?
    assert_includes setting.errors[:primary_color], "debe ser un color hexadecimal válido (ej. #4f46e5)"

    setting.primary_color = "#123456"
    assert setting.valid?
  end

  test "validates widget position inclusion" do
    setting = VisualhubSetting.current
    setting.widget_position = "invalid-pos"
    assert_not setting.valid?

    setting.widget_position = "bottom-left"
    assert setting.valid?
  end

  test "css_variables generates custom properties string" do
    setting = VisualhubSetting.current
    css = setting.css_variables
    assert_includes css, "--vh-primary: #4f46e5;"
    assert_includes css, "--vh-accent: #06b6d4;"
    assert_includes css, "--vh-sidebar-bg: #0f172a;"
  end

  test "validates logo_icon inclusion" do
    setting = VisualhubSetting.current
    setting.logo_icon = "invalid_icon"
    assert_not setting.valid?
    assert_includes setting.errors[:logo_icon], "is not included in the list"

    setting.logo_icon = "minimal_o"
    assert setting.valid?
  end

  test "render_logo_svg renders valid svg markup" do
    setting = VisualhubSetting.current
    setting.logo_icon = "cube"
    svg = setting.render_logo_svg(size: 24)
    assert_includes svg, "<svg width=\"24\" height=\"24\""
    assert_includes svg, "viewBox=\"0 0 24 24\""
  end
end
