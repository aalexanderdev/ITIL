class CreateKbArticles < ActiveRecord::Migration[8.1]
  def change
    create_table :kb_articles do |t|
      t.string :title, null: false
      t.text :content, null: false
      t.references :ticket_category, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.boolean :is_public, default: true, null: false
      t.integer :views_count, default: 0, null: false

      t.timestamps
    end

    add_index :kb_articles, :is_public
  end
end
