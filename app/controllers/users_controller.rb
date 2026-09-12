class UsersController < ApplicationController
  before_action :require_admin!
  before_action :set_user, only: %i[show edit update destroy]

  def index
    @users = User.includes(:department).order(:first_name, :last_name)
  end

  def show
    @requested_tickets = @user.requested_tickets.recent.limit(5)
    @assigned_tickets = @user.assigned_tickets.recent.limit(5)
    @assets = @user.assets
  end

  def new
    @user = User.new(role: "user", active: true)
  end

  def create
    @user = User.new(user_params)
    if @user.save
      redirect_to users_path, notice: "Usuario #{@user.full_name} creado con éxito."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    # Allow updating without password if empty
    attrs = user_params
    attrs.delete(:password) if attrs[:password].blank?

    if @user.update(attrs)
      redirect_to users_path, notice: "Usuario #{@user.full_name} actualizado."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    if @user.id == current_user.id
      redirect_to users_path, alert: "No puedes eliminar tu propio usuario."
    else
      @user.destroy
      redirect_to users_path, notice: "Usuario eliminado."
    end
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:email_address, :password, :first_name, :last_name, :role, :phone, :active, :department_id)
  end
end
