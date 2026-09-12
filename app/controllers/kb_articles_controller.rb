class KbArticlesController < ApplicationController
  before_action :set_article, only: %i[show edit update destroy]
  before_action :require_staff!, only: %i[new create edit update destroy]

  def index
    @categories = TicketCategory.all
    @articles = KbArticle.includes(:user, :ticket_category).recent

    unless current_user.staff?
      @articles = @articles.public_articles
    end

    if params[:category_id].present?
      @articles = @articles.where(ticket_category_id: params[:category_id])
    end

    if params[:query].present?
      q = "%#{params[:query]}%"
      @articles = @articles.where("title LIKE ? OR content LIKE ?", q, q)
    end
  end

  def show
    @article.increment_views!
  end

  def new
    @article = KbArticle.new(is_public: true)
  end

  def create
    @article = KbArticle.new(article_params)
    @article.user = current_user

    if @article.save
      redirect_to @article, notice: "Artículo de conocimiento publicado con éxito."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @article.update(article_params)
      redirect_to @article, notice: "Artículo actualizado correctamente."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    require_admin!
    @article.destroy
    redirect_to kb_articles_path, notice: "Artículo eliminado."
  end

  private

  def set_article
    @article = KbArticle.find(params[:id])
  end

  def article_params
    params.require(:kb_article).permit(:title, :content, :ticket_category_id, :is_public)
  end
end
