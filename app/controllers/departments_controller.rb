class DepartmentsController < ApplicationController
  before_action :require_admin!
  before_action :set_department, only: %i[edit update destroy]

  def index
    @departments = Department.includes(:location, :users, :assets).all
    @locations = Location.includes(:departments, :assets).all
  end

  def new
    @department = Department.new
  end

  def create
    @department = Department.new(department_params)
    if @department.save
      redirect_to departments_path, notice: "Departamento creado con éxito."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @department.update(department_params)
      redirect_to departments_path, notice: "Departamento actualizado."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @department.destroy
    redirect_to departments_path, notice: "Departamento eliminado."
  end

  private

  def set_department
    @department = Department.find(params[:id])
  end

  def department_params
    params.require(:department).permit(:name, :code, :location_id)
  end
end
