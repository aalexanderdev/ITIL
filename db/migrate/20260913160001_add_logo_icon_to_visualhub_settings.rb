class AddLogoIconToVisualhubSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :visualhub_settings, :logo_icon, :string, default: "cube", null: false
  end
end
