class UserProfilesController < ApplicationController
  before_action :set_user

  def show
    @requested_tickets = @user.requested_tickets.order(created_at: :desc).limit(5)
    @assigned_tickets = @user.assigned_tickets.order(created_at: :desc).limit(5) if @user.staff?
    @assets = @user.assets
  end

  def edit
  end

  def update
    if @user.update(user_params)
      redirect_to user_profile_path, notice: "Tu perfil ha sido actualizado exitosamente."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def update_password
    if !@user.authenticate(params[:current_password])
      redirect_to edit_user_profile_path, alert: "La contraseña actual ingresada es incorrecta."
    elsif params[:password].blank?
      redirect_to edit_user_profile_path, alert: "La nueva contraseña no puede estar vacía."
    elsif params[:password] != params[:password_confirmation]
      redirect_to edit_user_profile_path, alert: "La confirmación de contraseña no coincide."
    elsif @user.update(password: params[:password])
      redirect_to user_profile_path, notice: "Tu contraseña ha sido actualizada exitosamente."
    else
      redirect_to edit_user_profile_path, alert: @user.errors.full_messages.to_sentence
    end
  end

  private

  def set_user
    @user = current_user
  end

  def user_params
    params.require(:user).permit(:first_name, :last_name, :email_address, :phone)
  end
end
