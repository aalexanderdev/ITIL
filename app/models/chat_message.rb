class ChatMessage < ApplicationRecord
  belongs_to :chat_conversation
  belongs_to :user
  has_many :chat_message_reactions, dependent: :destroy

  validates :content, presence: true

  def date_creation
    created_at.to_i
  end

  def as_chat_json(current_user)
    is_mine = (user_id == current_user.id)
    ts = created_at.to_i
    author_name = user&.full_name.presence || "Sistema"

    {
      id: id,
      author: author_name,
      user_name: author_name,
      users_id: user_id,
      mine: is_mine,
      is_own: is_mine,
      content: content,
      date: ts,
      date_creation: ts,
      link_url: link_url.presence,
      attachment: nil
    }
  end
end
