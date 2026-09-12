class CreateTickets < ActiveRecord::Migration[8.1]
  def change
    create_table :tickets do |t|
      t.string :ticket_number, null: false
      t.string :ticket_type, default: "incident", null: false
      t.string :title, null: false
      t.text :description, null: false
      t.string :status, default: "new_ticket", null: false
      t.integer :urgency, default: 3, null: false
      t.integer :impact, default: 3, null: false
      t.integer :priority, default: 3, null: false

      t.references :requester, null: false, foreign_key: { to_table: :users }
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.references :asset, foreign_key: true
      t.references :ticket_category, foreign_key: true

      t.datetime :due_at
      t.datetime :resolved_at
      t.datetime :closed_at

      t.timestamps
    end

    add_index :tickets, :ticket_number, unique: true
    add_index :tickets, :status
    add_index :tickets, :priority
    add_index :tickets, :ticket_type
  end
end
