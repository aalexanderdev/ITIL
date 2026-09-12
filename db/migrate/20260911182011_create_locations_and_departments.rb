class CreateLocationsAndDepartments < ActiveRecord::Migration[8.1]
  def change
    create_table :locations do |t|
      t.string :name, null: false
      t.string :building
      t.string :floor
      t.string :room
      t.text :description

      t.timestamps
    end

    create_table :departments do |t|
      t.string :name, null: false
      t.string :code
      t.references :location, foreign_key: true

      t.timestamps
    end
  end
end
