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

  get "up" => "rails/health#show", as: :rails_health_check
end
