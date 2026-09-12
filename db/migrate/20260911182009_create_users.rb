class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email_address, null: false
      t.string :password_digest, null: false
      t.string :first_name
      t.string :last_name
      t.string :role, default: "user", null: false
      t.string :phone
      t.boolean :active, default: true, null: false
      t.integer :department_id

      t.timestamps
    end
    add_index :users, :email_address, unique: true
    add_index :users, :role
    add_index :users, :department_id
  end
end

