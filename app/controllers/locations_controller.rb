class LocationsController < ApplicationController
  before_action :require_admin!
  before_action :set_location, only: %i[edit update destroy]

  def new
    @location = Location.new
  end

  def create
    @location = Location.new(location_params)
    if @location.save
      redirect_to departments_path, notice: "Sede/Ubicación creada con éxito."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @location.update(location_params)
      redirect_to departments_path, notice: "Ubicación actualizada."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @location.destroy
    redirect_to departments_path, notice: "Ubicación eliminada."
  end

  private

  def set_location
    @location = Location.find(params[:id])
  end

  def location_params
    params.require(:location).permit(:name, :building, :floor, :room, :description)
  end
end
