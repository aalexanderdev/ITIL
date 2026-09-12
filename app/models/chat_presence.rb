class ChatPresence < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true

  ONLINE_TIMEOUT = 60 # seconds

  scope :online, -> { where("last_seen > ? AND status = ?", (Time.current.to_i - ONLINE_TIMEOUT), "online") }

  def self.heartbeat_for(user)
    presence = find_or_initialize_by(user_id: user.id)
    presence.update!(last_seen: Time.current.to_i, status: "online")
    presence
  end

  def self.set_offline_for(user)
    find_by(user_id: user.id)&.update!(status: "offline")
  end

  def self.online_user_ids
    online.pluck(:user_id)
  end

  def online?
    status == "online" && last_seen > (Time.current.to_i - ONLINE_TIMEOUT)
  end
end
