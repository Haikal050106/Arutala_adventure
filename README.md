# Arutala Adventure

Arutala Adventure is split into two independently runnable applications:

- `frontend/`: React, Vite, and Tailwind CSS storefront/admin UI.
- `backend/`: Ruby on Rails JSON API.
- `docs/PRD.md`: product requirements document.

## Requirements

- Node.js and npm for the frontend.
- Ruby and Bundler for the backend (see `backend/.ruby-version`).

## Run the Rails API

From the project root:

```powershell
cd backend
bundle install
bin/rails db:prepare
bin/rails server
```

The API is available at `http://localhost:3000`; `http://localhost:3000/up`
checks that the Rails server is responding.
To add the starter Sepatu Hiking and Hydropack variants to an existing database,
run `bin/rails db:seed` from `backend/` after migrations. This does not reset or
delete any database data; starter inventory is zero until configured in Admin.

## Run the frontend

In a separate terminal, from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Vite runs at `http://localhost:5173`. By default, frontend requests use the
same-origin `/api/v1` path, which Vite proxies to `http://localhost:3000`.
This avoids CORS failures when Vite selects a different port or hostname.
For deployments where the API is on another host, set `VITE_API_BASE_URL` to
that API's `/api/v1` URL and configure the Rails `FRONTEND_ORIGINS` accordingly.

To override the API URL, set `VITE_API_BASE_URL` in `frontend/.env.local`.
Start with `frontend/.env.example` as a template.

## Checks

Run frontend checks from `frontend/`:

```powershell
npm run lint
npm run build
```

Run backend checks from `backend/`:

```powershell
bundle exec rails test
bundle exec rails zeitwerk:check
bundle exec rubocop
```

Manage product models and their color/size stock combinations from Admin under
Products. Each combination can override prices and has its own Cloudinary photo.

See [docs/PRD.md](docs/PRD.md) for product requirements and
[backend/README.md](backend/README.md) for API details.
