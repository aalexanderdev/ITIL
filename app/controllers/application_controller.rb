class ApplicationController < ActionController::Base
  include Authentication
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  helper_method :current_user

  def current_user
    Current.user
  end

  def require_staff!
    unless current_user&.staff?
      redirect_to root_path, alert: "No tienes permisos para acceder a esta sección técnica."
    end
  end

  def require_admin!
    unless current_user&.admin?
      redirect_to root_path, alert: "Esta sección requiere privilegios de Administrador."
    end
  end

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes
end
