module Chat
  class BaseController < ApplicationController
    protect_from_forgery with: :null_session

    before_action :ensure_chat_user

    private

    def requested_action
      params[:action_type].presence ||
        request.query_parameters["action"].presence ||
        request.request_parameters["action"].presence ||
        (params[:action] != "handle" ? params[:action].presence : nil)
    end

    def request_authentication
      render json: { success: false, error: "unauthorized" }, status: :unauthorized
    end

    def ensure_chat_user
      unless current_user
        render json: { success: false, error: "unauthorized" }, status: :unauthorized
      end
    end
  end
end
