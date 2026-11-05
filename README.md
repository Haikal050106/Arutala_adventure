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

## Run the frontend

In a separate terminal, from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Vite runs at `http://localhost:5173`. The frontend defaults to the API at
`http://localhost:3000/api/v1`; the backend CORS configuration allows the
default Vite development and preview origins.

To override the API URL, set `VITE_API_BASE_URL` in `frontend/.env.local`.
Start with `frontend/.env.example` as a template. If using a different frontend
origin, set the comma-separated `FRONTEND_ORIGINS` environment variable for
the Rails process.

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

See [docs/PRD.md](docs/PRD.md) for product requirements and
[backend/README.md](backend/README.md) for API details.
