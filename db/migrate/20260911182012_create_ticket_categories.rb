class CreateTicketCategories < ActiveRecord::Migration[8.1]
  def change
    create_table :ticket_categories do |t|
      t.string :name, null: false
      t.text :description
      t.string :color, default: "#4f46e5"

      t.timestamps
    end
  end
end
