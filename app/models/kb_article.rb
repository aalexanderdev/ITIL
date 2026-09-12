class KbArticle < ApplicationRecord
  belongs_to :ticket_category, optional: true
  belongs_to :user

  validates :title, presence: true
  validates :content, presence: true

  scope :public_articles, -> { where(is_public: true) }
  scope :recent, -> { order(created_at: :desc) }
  scope :popular, -> { order(views_count: :desc) }

  def increment_views!
    increment!(:views_count)
  end
end
