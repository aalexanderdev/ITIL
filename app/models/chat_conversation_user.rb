class ChatConversationUser < ApplicationRecord
  belongs_to :chat_conversation
  belongs_to :user

  validates :user_id, uniqueness: { scope: :chat_conversation_id }

  def mark_read!
    update!(last_read: Time.current.to_i + 1)
  end

  def touch_typing!
    update!(last_typing: Time.current.to_i)
  end

  def clear_typing!
    update!(last_typing: 0)
  end

  def typing?
    last_typing.present? && last_typing > (Time.current.to_i - 4)
  end
end
