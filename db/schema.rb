# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_12_200001) do
  create_table "assets", force: :cascade do |t|
    t.string "asset_tag", null: false
    t.string "asset_type", default: "computer", null: false
    t.string "cpu"
    t.datetime "created_at", null: false
    t.integer "department_id"
    t.string "ip_address"
    t.integer "location_id"
    t.string "mac_address"
    t.string "manufacturer"
    t.string "model"
    t.string "name", null: false
    t.text "notes"
    t.string "operating_system"
    t.date "purchase_date"
    t.integer "ram_gb"
    t.string "serial_number"
    t.string "status", default: "in_use", null: false
    t.string "storage_capacity"
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.date "warranty_expiry"
    t.index ["asset_tag"], name: "index_assets_on_asset_tag", unique: true
    t.index ["asset_type"], name: "index_assets_on_asset_type"
    t.index ["department_id"], name: "index_assets_on_department_id"
    t.index ["location_id"], name: "index_assets_on_location_id"
    t.index ["serial_number"], name: "index_assets_on_serial_number"
    t.index ["status"], name: "index_assets_on_status"
    t.index ["user_id"], name: "index_assets_on_user_id"
  end

  create_table "chat_conversation_users", force: :cascade do |t|
    t.integer "chat_conversation_id", null: false
    t.datetime "created_at", null: false
    t.boolean "is_featured", default: false, null: false
    t.integer "last_read", default: 0, null: false
    t.integer "last_typing", default: 0, null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["chat_conversation_id", "user_id"], name: "idx_chat_conv_users_unique", unique: true
    t.index ["chat_conversation_id"], name: "index_chat_conversation_users_on_chat_conversation_id"
    t.index ["user_id"], name: "index_chat_conversation_users_on_user_id"
  end

  create_table "chat_conversations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "department_id"
    t.boolean "is_group", default: false, null: false
    t.boolean "is_self", default: false, null: false
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["department_id"], name: "index_chat_conversations_on_department_id"
  end

  create_table "chat_message_reactions", force: :cascade do |t|
    t.integer "chat_message_id", null: false
    t.datetime "created_at", null: false
    t.string "emoji", default: "👍", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["chat_message_id", "user_id", "emoji"], name: "idx_chat_reactions_unique", unique: true
    t.index ["chat_message_id"], name: "index_chat_message_reactions_on_chat_message_id"
    t.index ["user_id"], name: "index_chat_message_reactions_on_user_id"
  end

  create_table "chat_messages", force: :cascade do |t|
    t.integer "chat_conversation_id", null: false
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.string "link_url"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["chat_conversation_id"], name: "index_chat_messages_on_chat_conversation_id"
    t.index ["created_at"], name: "index_chat_messages_on_created_at"
    t.index ["user_id"], name: "index_chat_messages_on_user_id"
  end

  create_table "chat_presences", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "last_seen", default: 0, null: false
    t.string "status", default: "offline", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_chat_presences_on_user_id", unique: true
  end

  create_table "chat_settings", force: :cascade do |t|
    t.string "bubble_color", default: "#4f46e5", null: false
    t.datetime "created_at", null: false
    t.integer "font_size", default: 14, null: false
    t.string "launcher_color", default: "#4f46e5", null: false
    t.integer "max_message_length", default: 2000, null: false
    t.string "mention_color", default: "#4338ca", null: false
    t.boolean "notification_sound_enabled", default: true, null: false
    t.boolean "notify_on_assignment", default: true, null: false
    t.boolean "notify_on_comment", default: true, null: false
    t.boolean "notify_on_private_note", default: true, null: false
    t.boolean "notify_on_solution", default: true, null: false
    t.integer "panel_width_px", default: 380, null: false
    t.integer "poll_conversations_ms", default: 10000, null: false
    t.integer "poll_messages_ms", default: 2000, null: false
    t.integer "poll_online_users_ms", default: 30000, null: false
    t.integer "poll_presence_ms", default: 30000, null: false
    t.boolean "presence_enabled", default: true, null: false
    t.boolean "reactions_enabled", default: true, null: false
    t.boolean "read_receipts_enabled", default: true, null: false
    t.text "shortcut_buttons_json"
    t.boolean "ticket_conversion_enabled", default: true, null: false
    t.boolean "ticket_conversion_on_received", default: true, null: false
    t.boolean "ticket_conversion_on_sent", default: false, null: false
    t.string "ticket_conversion_requester", default: "converter", null: false
    t.boolean "typing_indicator_enabled", default: true, null: false
    t.datetime "updated_at", null: false
  end

  create_table "departments", force: :cascade do |t|
    t.string "code"
    t.datetime "created_at", null: false
    t.integer "location_id"
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["location_id"], name: "index_departments_on_location_id"
  end

  create_table "kb_articles", force: :cascade do |t|
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.boolean "is_public", default: true, null: false
    t.integer "ticket_category_id"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.integer "views_count", default: 0, null: false
    t.index ["is_public"], name: "index_kb_articles_on_is_public"
    t.index ["ticket_category_id"], name: "index_kb_articles_on_ticket_category_id"
    t.index ["user_id"], name: "index_kb_articles_on_user_id"
  end

  create_table "locations", force: :cascade do |t|
    t.string "building"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "floor"
    t.string "name", null: false
    t.string "room"
    t.datetime "updated_at", null: false
  end

  create_table "profiles", force: :cascade do |t|
    t.boolean "admin_access", default: false, null: false
    t.boolean "asset_manage", default: false, null: false
    t.boolean "asset_view", default: true, null: false
    t.string "base_role", default: "user", null: false
    t.boolean "chat_access", default: true, null: false
    t.boolean "chat_config", default: false, null: false
    t.boolean "chat_convert_ticket", default: false, null: false
    t.string "color", default: "#4f46e5", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "is_default", default: false, null: false
    t.boolean "kb_manage", default: false, null: false
    t.boolean "kb_view", default: true, null: false
    t.string "name", null: false
    t.boolean "ticket_all_view", default: false, null: false
    t.boolean "ticket_assign", default: false, null: false
    t.boolean "ticket_close", default: false, null: false
    t.boolean "ticket_create", default: true, null: false
    t.boolean "ticket_delete", default: false, null: false
    t.boolean "ticket_edit", default: false, null: false
    t.boolean "ticket_private_notes", default: false, null: false
    t.boolean "ticket_solve", default: false, null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_profiles_on_name", unique: true
  end

  create_table "sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "ticket_categories", force: :cascade do |t|
    t.string "color", default: "#4f46e5"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.datetime "updated_at", null: false
  end

  create_table "ticket_updates", force: :cascade do |t|
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.string "solution_status"
    t.integer "ticket_id", null: false
    t.integer "time_spent_minutes", default: 0
    t.string "update_type", default: "comment", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["ticket_id"], name: "index_ticket_updates_on_ticket_id"
    t.index ["update_type"], name: "index_ticket_updates_on_update_type"
    t.index ["user_id"], name: "index_ticket_updates_on_user_id"
  end

  create_table "tickets", force: :cascade do |t|
    t.integer "asset_id"
    t.integer "assigned_to_id"
    t.datetime "closed_at"
    t.datetime "created_at", null: false
    t.text "description", null: false
    t.datetime "due_at"
    t.integer "impact", default: 3, null: false
    t.integer "priority", default: 3, null: false
    t.integer "requester_id", null: false
    t.datetime "resolved_at"
    t.string "status", default: "new_ticket", null: false
    t.integer "ticket_category_id"
    t.string "ticket_number", null: false
    t.string "ticket_type", default: "incident", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.integer "urgency", default: 3, null: false
    t.index ["asset_id"], name: "index_tickets_on_asset_id"
    t.index ["assigned_to_id"], name: "index_tickets_on_assigned_to_id"
    t.index ["priority"], name: "index_tickets_on_priority"
    t.index ["requester_id"], name: "index_tickets_on_requester_id"
    t.index ["status"], name: "index_tickets_on_status"
    t.index ["ticket_category_id"], name: "index_tickets_on_ticket_category_id"
    t.index ["ticket_number"], name: "index_tickets_on_ticket_number", unique: true
    t.index ["ticket_type"], name: "index_tickets_on_ticket_type"
  end

  create_table "users", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.integer "department_id"
    t.string "email_address", null: false
    t.string "first_name"
    t.string "last_name"
    t.string "password_digest", null: false
    t.string "phone"
    t.integer "profile_id"
    t.string "role", default: "user", null: false
    t.datetime "updated_at", null: false
    t.index ["department_id"], name: "index_users_on_department_id"
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
    t.index ["profile_id"], name: "index_users_on_profile_id"
    t.index ["role"], name: "index_users_on_role"
  end

  add_foreign_key "assets", "departments"
  add_foreign_key "assets", "locations"
  add_foreign_key "assets", "users"
  add_foreign_key "chat_conversation_users", "chat_conversations"
  add_foreign_key "chat_conversation_users", "users"
  add_foreign_key "chat_conversations", "departments"
  add_foreign_key "chat_message_reactions", "chat_messages"
  add_foreign_key "chat_message_reactions", "users"
  add_foreign_key "chat_messages", "chat_conversations"
  add_foreign_key "chat_messages", "users"
  add_foreign_key "chat_presences", "users"
  add_foreign_key "departments", "locations"
  add_foreign_key "kb_articles", "ticket_categories"
  add_foreign_key "kb_articles", "users"
  add_foreign_key "sessions", "users"
  add_foreign_key "ticket_updates", "tickets"
  add_foreign_key "ticket_updates", "users"
  add_foreign_key "tickets", "assets"
  add_foreign_key "tickets", "ticket_categories"
  add_foreign_key "tickets", "users", column: "assigned_to_id"
  add_foreign_key "tickets", "users", column: "requester_id"
  add_foreign_key "users", "profiles"
end
