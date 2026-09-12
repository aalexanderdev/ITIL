class ChatMessageReaction < ApplicationRecord
  belongs_to :chat_message
  belongs_to :user

  validates :emoji, presence: true
  validates :user_id, uniqueness: { scope: [ :chat_message_id, :emoji ] }
end
