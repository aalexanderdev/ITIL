class CreateTicketUpdates < ActiveRecord::Migration[8.1]
  def change
    create_table :ticket_updates do |t|
      t.references :ticket, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :update_type, default: "comment", null: false
      t.text :content, null: false
      t.integer :time_spent_minutes, default: 0
      t.string :solution_status

      t.timestamps
    end

    add_index :ticket_updates, :update_type
  end
end
