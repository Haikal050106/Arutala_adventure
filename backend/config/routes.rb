Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      post "auth/login", to: "auth#login"
      post "auth/customer/register", to: "auth#customer_register"
      post "auth/customer/login", to: "auth#customer_login"
      delete "auth/logout", to: "auth#logout"
      get "auth/me", to: "auth#me"
      get "dashboard", to: "reports#dashboard"
      post "webhooks/midtrans", to: "midtrans_webhooks#create"
      post "customer/payments/:payment_id/refresh", to: "customer_payments#refresh"
      resources :users, only: %i[index show create update destroy]
      resources :categories, only: %i[index show create update destroy]
      resources :products, only: %i[index show create update destroy], param: :id do
        get :rental_availability, on: :member
        resources :photos, controller: :product_photos, only: %i[create update destroy]
      end
      resources :customers, only: %i[index show create update destroy]
      resources :orders, only: %i[index show create update destroy] do
        resources :items, controller: :order_items, only: %i[index show]
        resources :payments, controller: :payments, only: %i[index create] do
          post :confirm, on: :member
        end
      end
      resources :customer_orders, path: "customer/orders", controller: :customer_orders, only: %i[index show create] do
        member do
          post :cancel
        end
      end
      resources :rentals, only: %i[index show create update destroy] do
        resources :items, controller: :rental_items, only: %i[index show]
        resources :payments, controller: :payments, only: %i[index create] do
          post :confirm, on: :member
        end
      end
      resources :customer_rentals, path: "customer/rentals", controller: :customer_rentals, only: %i[index show create]
    end
  end

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"
end
