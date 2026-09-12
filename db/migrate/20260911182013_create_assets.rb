class CreateAssets < ActiveRecord::Migration[8.1]
  def change
    create_table :assets do |t|
      t.string :asset_tag, null: false
      t.string :name, null: false
      t.string :asset_type, default: "computer", null: false
      t.string :manufacturer
      t.string :model
      t.string :serial_number
      t.string :status, default: "in_use", null: false
      t.references :user, foreign_key: true
      t.references :department, foreign_key: true
      t.references :location, foreign_key: true
      t.string :ip_address
      t.string :mac_address
      t.string :operating_system
      t.string :cpu
      t.integer :ram_gb
      t.string :storage_capacity
      t.date :purchase_date
      t.date :warranty_expiry
      t.text :notes

      t.timestamps
    end

    add_index :assets, :asset_tag, unique: true
    add_index :assets, :serial_number
    add_index :assets, :asset_type
    add_index :assets, :status
  end
end
