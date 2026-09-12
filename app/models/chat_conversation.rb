class ChatConversation < ApplicationRecord
  has_many :chat_conversation_users, dependent: :destroy
  has_many :users, through: :chat_conversation_users
  has_many :chat_messages, dependent: :destroy
  belongs_to :department, optional: true

  scope :groups, -> { where(is_group: true) }
  scope :direct, -> { where(is_group: false, is_self: false) }
  scope :self_threads, -> { where(is_self: true) }

  def self.find_or_create_direct(user1, user2)
    return find_or_create_self(user1) if user1.id == user2.id

    # Look for existing direct conversation with both users
    common_conv_id = ChatConversationUser.where(user_id: user1.id)
                                         .joins(:chat_conversation)
                                         .where(chat_conversations: { is_group: false, is_self: false })
                                         .where(chat_conversation_id: ChatConversationUser.where(user_id: user2.id).select(:chat_conversation_id))
                                         .pick(:chat_conversation_id)

    if common_conv_id
      ChatConversation.find(common_conv_id)
    else
      conv = ChatConversation.create!(is_group: false, is_self: false)
      conv.chat_conversation_users.create!(user: user1)
      conv.chat_conversation_users.create!(user: user2)
      conv
    end
  end

  def self.find_or_create_self(user)
    conv = joins(:chat_conversation_users).find_by(is_self: true, chat_conversation_users: { user_id: user.id })
    return conv if conv

    conv = ChatConversation.create!(is_self: true, name: "Notificaciones del Sistema")
    conv.chat_conversation_users.create!(user: user)
    conv
  end

  def self.sync_department_conversations
    Department.find_each do |dep|
      conv = find_or_create_by!(department_id: dep.id, is_group: true) do |c|
        c.name = "Grupo: #{dep.name}"
      end
      # Add department users to conversation
      dep.users.find_each do |u|
        conv.chat_conversation_users.find_or_create_by!(user: u)
      end
    end
  end

  def display_name_for(current_user)
    if is_self?
      "Notificaciones del Sistema"
    elsif is_group?
      name.presence || department&.name || "Sala Grupal"
    else
      other = other_user_for(current_user)
      other&.full_name || "Conversación Privada"
    end
  end

  def other_user_for(current_user)
    return current_user if is_self?
    users.where.not(id: current_user.id).first
  end

  def unread_count_for(user)
    cu = chat_conversation_users.find_by(user_id: user.id)
    return 0 unless cu

    last_read_ts = cu.last_read || 0
    chat_messages.where("created_at > ?", Time.at(last_read_ts)).where.not(user_id: user.id).count
  end

  def last_message
    chat_messages.order(id: :desc).first
  end

  def mentionable_users
    if is_group?
      users.active.map { |u| { id: u.id, name: u.full_name } }
    else
      []
    end
  end
end
