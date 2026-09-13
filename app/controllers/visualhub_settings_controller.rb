class VisualhubSettingsController < ApplicationController
  before_action :require_admin!
  before_action :set_setting

  def show
    redirect_to edit_visualhub_settings_path
  end

  def edit
  end

  def update
    if @setting.update(visualhub_setting_params)
      redirect_to edit_visualhub_settings_path, notice: "Configuración de VisualHub y Accesibilidad actualizada con éxito."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_setting
    @setting = VisualhubSetting.current
  end

  def visualhub_setting_params
    params.require(:visualhub_setting).permit(
      :app_name, :app_subtitle, :logo_url, :logo_icon, :login_title, :footer_text,
      :primary_color, :accent_color, :sidebar_bg, :default_dark_mode,
      :accessibility_enabled, :widget_position, :tts_enabled, :tts_default_lang,
      :tts_speed, :point_to_read, :keyboard_shortcuts_enabled,
      :high_contrast_default, :readable_font_default
    )
  end
end
