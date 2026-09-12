class ChatSettingsController < ApplicationController
  before_action :require_admin!
  before_action :set_chat_setting

  def show
    redirect_to edit_chat_settings_path
  end

  def edit
  end

  def update
    if @chat_setting.update(chat_setting_params)
      redirect_to edit_chat_settings_path, notice: "Configuración de HelpdeskChat actualizada exitosamente."
    else
      flash.now[:alert] = "Error al actualizar la configuración: #{@chat_setting.errors.full_messages.join(', ')}"
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_chat_setting
    @chat_setting = ChatSetting.current
  end

  def chat_setting_params
    params.require(:chat_setting).permit(
      :panel_width_px,
      :bubble_color,
      :mention_color,
      :launcher_color,
      :font_size,
      :poll_messages_ms,
      :poll_conversations_ms,
      :poll_online_users_ms,
      :poll_presence_ms,
      :max_message_length,
      :reactions_enabled,
      :notification_sound_enabled,
      :presence_enabled,
      :typing_indicator_enabled,
      :read_receipts_enabled,
      :ticket_conversion_enabled,
      :ticket_conversion_on_received,
      :ticket_conversion_on_sent,
      :ticket_conversion_requester,
      :notify_on_assignment,
      :notify_on_solution,
      :notify_on_comment,
      :notify_on_private_note,
      :shortcut_buttons_json
    )
  end
end
