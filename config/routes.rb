Rails.application.routes.draw do
  root "dashboard#index"

  resource :session, only: %i[new create destroy]
  resources :passwords, param: :token

  resources :tickets do
    resources :ticket_updates, only: %i[create destroy]
    member do
      patch :solve
      patch :close
      patch :reopen
      patch :assign_to_me
    end
  end

  resources :assets
  resources :kb_articles
  resources :users
  resources :departments
  resources :locations
  resources :ticket_categories

  # HelpdeskChat Native Endpoints
  scope "chat/ajax", module: :chat do
    get "token", to: "token#show"
    get "token.php", to: "token#show"

    match "conversations", to: "conversations#handle", via: %i[get post]
    match "conversations.php", to: "conversations#handle", via: %i[get post]

    match "messages", to: "messages#handle", via: %i[get post]
    match "messages.php", to: "messages#handle", via: %i[get post]

    match "presence", to: "presence#handle", via: %i[get post]
    match "presence.php", to: "presence#handle", via: %i[get post]

    match "tickets", to: "tickets#handle", via: %i[get post]
    match "tickets.php", to: "tickets#handle", via: %i[get post]
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
