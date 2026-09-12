class ChatMessage < ApplicationRecord
  belongs_to :chat_conversation
  belongs_to :user
  has_many :chat_message_reactions, dependent: :destroy

  validates :content, presence: true

  def date_creation
    created_at.to_i
  end

  def as_chat_json(current_user)
    {
      id: id,
      users_id: user_id,
      user_name: user&.full_name || "Sistema",
      content: content,
      date_creation: created_at.to_i,
      is_own: (user_id == current_user.id),
      link_url: link_url.presence,
      attachment: nil
    }
  end
end
