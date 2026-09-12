class CreateChatTables < ActiveRecord::Migration[8.1]
  def change
    create_table :chat_conversations do |t|
      t.string :name
      t.boolean :is_group, default: false, null: false
      t.boolean :is_self, default: false, null: false
      t.references :department, foreign_key: true

      t.timestamps
    end

    create_table :chat_conversation_users do |t|
      t.references :chat_conversation, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :last_read, default: 0, null: false
      t.integer :last_typing, default: 0, null: false
      t.boolean :is_featured, default: false, null: false

      t.timestamps
    end

    add_index :chat_conversation_users, [ :chat_conversation_id, :user_id ], unique: true, name: "idx_chat_conv_users_unique"

    create_table :chat_messages do |t|
      t.references :chat_conversation, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.text :content, null: false
      t.string :link_url

      t.timestamps
    end

    add_index :chat_messages, :created_at

    create_table :chat_message_reactions do |t|
      t.references :chat_message, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :emoji, default: "👍", null: false

      t.timestamps
    end

    add_index :chat_message_reactions, [ :chat_message_id, :user_id, :emoji ], unique: true, name: "idx_chat_reactions_unique"

    create_table :chat_presences do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.integer :last_seen, default: 0, null: false
      t.string :status, default: "offline", null: false

      t.timestamps
    end
  end
end
