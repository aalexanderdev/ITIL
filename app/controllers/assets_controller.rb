class AssetsController < ApplicationController
  before_action :set_asset, only: %i[show edit update destroy]
  before_action :require_staff!, only: %i[new create edit update destroy]

  def index
    @assets = Asset.includes(:user, :department, :location).recent

    if params[:asset_type].present?
      @assets = @assets.where(asset_type: params[:asset_type])
    end

    if params[:status].present?
      @assets = @assets.where(status: params[:status])
    end

    if params[:location_id].present?
      @assets = @assets.where(location_id: params[:location_id])
    end

    if params[:query].present?
      q = "%#{params[:query]}%"
      @assets = @assets.where("asset_tag LIKE ? OR name LIKE ? OR serial_number LIKE ? OR ip_address LIKE ? OR model LIKE ?", q, q, q, q, q)
    end
  end

  def show
    @tickets = @ticket_history = @asset.tickets.recent.includes(:requester, :assigned_to)
  end

  def new
    @asset = Asset.new(status: "in_use", asset_type: "computer")
  end

  def create
    @asset = Asset.new(asset_params)
    if @asset.save
      redirect_to @asset, notice: "Activo #{@asset.asset_tag} registrado correctamente en el inventario."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @asset.update(asset_params)
      redirect_to @asset, notice: "Activo #{@asset.asset_tag} actualizado correctamente."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    require_admin!
    @asset.destroy
    redirect_to assets_path, notice: "Activo eliminado del inventario."
  end

  private

  def set_asset
    @asset = Asset.find(params[:id])
  end

  def asset_params
    params.require(:asset).permit(
      :asset_tag, :name, :asset_type, :manufacturer, :model, :serial_number,
      :status, :user_id, :department_id, :location_id, :ip_address, :mac_address,
      :operating_system, :cpu, :ram_gb, :storage_capacity, :purchase_date,
      :warranty_expiry, :notes
    )
  end
end
