require "test_helper"

class ChatSettingTest < ActiveSupport::TestCase
  test "current returns the default singleton configuration" do
    setting = ChatSetting.current
    assert_not_nil setting
    assert_equal 380, setting.panel_width_px
    assert_equal "#4f46e5", setting.bubble_color
    assert_equal "#4f46e5", setting.launcher_color
    assert_equal 14, setting.font_size
    assert_equal true, setting.presence_enabled
    assert_equal true, setting.reactions_enabled
    assert_equal true, setting.ticket_conversion_enabled
    assert setting.parsed_shortcut_buttons.is_a?(Array)
  end

  test "validates hex colors" do
    setting = ChatSetting.current
    setting.bubble_color = "not-a-color"
    assert_not setting.valid?
    assert_includes setting.errors[:bubble_color], "is invalid"

    setting.bubble_color = "#10b981"
    assert setting.valid?
  end

  test "validates numeric ranges" do
    setting = ChatSetting.current
    setting.panel_width_px = 100
    assert_not setting.valid?

    setting.panel_width_px = 420
    assert setting.valid?
  end
end
