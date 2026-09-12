class ProfilesController < ApplicationController
  before_action :require_admin!
  before_action :set_profile, only: %i[show edit update destroy]

  def index
    @profiles = Profile.includes(:users).ordered
  end

  def show
    @users = @profile.users.order(:first_name, :last_name)
  end

  def new
    @profile = Profile.new(
      color: "#4f46e5",
      base_role: "user",
      ticket_create: true,
      asset_view: true,
      kb_view: true,
      chat_access: true
    )
  end

  def create
    @profile = Profile.new(profile_params)
    if @profile.save
      redirect_to profiles_path, notice: "Perfil '#{@profile.name}' creado exitosamente."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @profile.update(profile_params)
      redirect_to profiles_path, notice: "Perfil '#{@profile.name}' actualizado exitosamente."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    if @profile.users.any?
      redirect_to profiles_path, alert: "No se puede eliminar el perfil porque tiene #{@profile.users.count} usuario(s) asignado(s). Reasigna los usuarios primero."
    elsif Profile.count <= 1
      redirect_to profiles_path, alert: "Debe existir al menos un perfil en el sistema."
    else
      @profile.destroy
      redirect_to profiles_path, notice: "Perfil eliminado."
    end
  end

  private

  def set_profile
    @profile = Profile.find(params[:id])
  end

  def profile_params
    params.require(:profile).permit(
      :name, :description, :color, :base_role, :is_default,
      :ticket_all_view, :ticket_create, :ticket_edit, :ticket_assign,
      :ticket_solve, :ticket_close, :ticket_delete, :ticket_private_notes,
      :asset_view, :asset_manage,
      :kb_view, :kb_manage,
      :chat_access, :chat_convert_ticket, :chat_config,
      :admin_access
    )
  end
end
