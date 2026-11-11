# README

This is the Rails API backend for Arutala Adventure.

## Development setup

- Ruby version: see `.ruby-version`
- Install dependencies with `bundle install`.
- Prepare the development SQLite database with `bin/rails db:prepare`.
- Start the API with `bin/rails server` (default: `http://localhost:3000`).

The API currently stores categories and products in SQLite. No demo records are
created automatically.

## Category and product API

All endpoints are JSON under `/api/v1`.

- `GET /api/v1/categories` and `GET /api/v1/categories/:id`
- `POST /api/v1/categories`, `PATCH/PUT /api/v1/categories/:id`, `DELETE /api/v1/categories/:id`
- `GET /api/v1/products` and `GET /api/v1/products/:slug`
- `POST /api/v1/products`, `PATCH/PUT /api/v1/products/:slug`, `DELETE /api/v1/products/:slug`

Category payload example: `{"category":{"name":"Tenda","description":"Perlengkapan tenda."}}`.
Product payloads use `category_id`, `name`, `description`, `sale_price`,
`rent_price_per_day`, `sale_stock`, `rental_stock`, and optional `slug`,
`featured`, `image_url`, and `image_alt`. Product responses include the related
category and a derived `available`/`availability_status` based on both stock
counts. Category deletion returns `409 Conflict` while products still refer to it.

### Product photos (Cloudinary)

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
in the Rails process environment. For local development, copy `.env.example` to
`.env` under `backend/` and fill in the values; `.env` is ignored by Git.
Never put these credentials in `frontend/.env*`, browser code, or a Vite
`VITE_` variable. Kamal deployment reads the same names as server secrets.

Uploads use the `arutala-adventure/produk` Cloudinary folder. The API accepts
JPEG, PNG, and WebP files up to 10 MB, with at most 10 photos per product:

- `POST /api/v1/products/:slug/photos` with multipart field `file`
- `PATCH /api/v1/products/:slug/photos/:id` with optional multipart `file`;
  send JSON `is_primary: true` to select the main image
- `DELETE /api/v1/products/:slug/photos/:id`

Photo mutations require the same Admin-only authorization as product CRUD.
Catalog responses include ordered `photos` metadata and expose the main
`secure_url` as the compatibility `image_url`. The database retains the
Cloudinary `public_id` for server-side replacement/deletion; it is not returned
to storefront clients. Replacements upload and save the new asset before
cleaning up the old Cloudinary asset.

## Customers, orders, and rentals

- Customers: `GET/POST /api/v1/customers` and
  `GET/PATCH/PUT/DELETE /api/v1/customers/:id`. Customer JSON fields are
  `name`, `email`, `phone`, and optional `village_name`.
- Purchase orders: `GET/POST /api/v1/orders` and
  `GET/PATCH/PUT/DELETE /api/v1/orders/:id`. Create with
  `{"order":{"customer_id":1,"items":[{"product_id":1,"quantity":2}]}}`.
  Read details from `GET /api/v1/orders/:order_id/items` or
  `GET /api/v1/orders/:order_id/items/:id`.
  Unit prices and totals are read from the database, not accepted from clients.
  Orders start as `pending_confirmation`; patch `status` to `confirmed` to
  deduct sale stock. Valid transitions are enforced, and cancellation restores
  stock if it was previously deducted.
- Rentals: `GET/POST /api/v1/rentals` and
  `GET/PATCH/PUT/DELETE /api/v1/rentals/:id`. Create with
  `{"rental":{"customer_id":1,"village_name":"Desa Contoh","items":[{"product_id":1,"quantity":1,"start_date":"2026-12-01","return_date":"2026-12-04"}]}}`.
  Read details from `GET /api/v1/rentals/:rental_id/items` or
  `GET /api/v1/rentals/:rental_id/items/:id`.
  Each rental item stores its own dates and server-derived daily price. Date
  ranges use `[start_date, return_date)`; overlapping active bookings are
  checked against rental stock. `village_name` is required and is stored on the
  rental transaction. A returned rental exposes `return_status: "returned"`.

Transaction detail records are returned nested with their order or rental and
are created atomically through the parent endpoint. Detail endpoints are
read-only so item history and stock snapshots cannot be changed independently.
Their prices are snapshots; clients cannot directly write or change item prices.
Only pending or cancelled transactions can be deleted.

Validation errors use HTTP `422` with an `error` object containing a message and
details; missing records return `404`.

The Vite development origins on ports `5173` and preview origins on port `4173`
are allowed by default. Override them with a comma-separated `FRONTEND_ORIGINS`
environment variable when needed.

## Authentication and authorization

- `POST /api/v1/auth/login` accepts
  `{"auth":{"email":"admin@example.com","password":"..."}}` and returns a
  12-hour bearer token with the user profile. Passwords are bcrypt hashes;
  only a SHA-256 digest of each session token is stored in SQLite.
- Send `Authorization: Bearer <token>` to protected endpoints.
- `GET /api/v1/auth/me` returns the current user's safe profile.
- `DELETE /api/v1/auth/logout` revokes the current token.
- `GET/POST /api/v1/users`, `GET/PATCH/PUT/DELETE /api/v1/users/:id` are Admin-only.
  The current Admin cannot change their own role or delete their own account;
  changing a user's password revokes that user's sessions.
- Category and product reads remain public for the storefront. Their mutations
  and user management require Admin. Customer, order, and rental endpoints
  require Admin or Kasir; customer updates and deletion require Admin.
- Missing/expired authentication returns `401`; insufficient role returns `403`.

Create the first Admin interactively; the password prompt does not echo input:

```powershell
bundle exec rails users:create_admin
```

Run the API from the `backend/` directory with `bin/rails server`. Run the
frontend separately from the sibling `frontend/` directory with `npm run dev`.
The frontend defaults to `http://localhost:3000/api/v1`; override it with
`VITE_API_BASE_URL` in `frontend/.env.local`. Set `FRONTEND_ORIGINS` in the
backend environment to a comma-separated list when the frontend uses a
different origin. The default CORS configuration already allows Vite's
development origin on port `5173` and preview origin on port `4173`.

The admin UI now uses real API authentication, but its business pages remain
the existing local demo interface and are not yet wired to these API resources.
Bearer tokens are held in `sessionStorage`, which is accessible to page scripts:
use HTTPS and strong XSS/CSP controls before deployment. Review deployment
configuration and conduct a security review before production use.

## Tests

Run the Rails tests with `bin/rails test`.
