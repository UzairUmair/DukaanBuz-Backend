# DukaanSaz Backend

A Node.js, Express, MongoDB, and Mongoose REST API for a multi-tenant Pakistani product catalog and storefront SaaS. It is intentionally structured for an SMIT assignment: models, controllers, routes, and middleware each have clear responsibilities without unnecessary layers.

## Requirements

- Node.js 20+ (Node 26 works)
- Local MongoDB Community Server running for normal development
- MongoDB Compass (optional, for inspecting records)

## Install and run

From the `backend` folder:

```bash
npm install
```

Copy `.env.example` to `.env`. The project includes a **development-only** `.env` configured for a local database named `dukaansaz`; replace `JWT_SECRET` before deploying.

```bash
npm run dev
```

The server starts only after MongoDB connects successfully:

```text
MongoDB connected: 127.0.0.1
DukaanSaz API running at http://localhost:5000
```

Use `npm start` for the non-nodemon command.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend HTTP port (`5000`) |
| `MONGODB_URI` | Local MongoDB URI, e.g. `mongodb://127.0.0.1:27017/dukaansaz` |
| `JWT_SECRET` | Long secret used to sign JWTs (at least 32 characters) |
| `JWT_EXPIRES_IN` | JWT lifetime, default `7d` |
| `CLIENT_URL` | Exact CORS-allowed frontend origins, comma-separated when necessary (localhost is always allowed for development) |
| `DEMO_EMAIL` | Designated demo seller email, required only for `npm run seed:demo` |
| `DEMO_PASSWORD` | Private demo seller password (at least 12 characters), required only for `npm run seed:demo` |

`.env` is ignored by Git. Do not commit it.

## Main backend concepts demonstrated

- **Express Router:** each API area owns a router in `routes/`, mounted from `index.js`.
- **Middleware:** JSON parsing, strict development CORS, authentication, Multer uploads, validation, not-found replies, and central error handling.
- **Mongoose schemas/models:** validation rules reside close to `User`, `Store`, and `Product` data.
- **ObjectId relationships:** stores reference their owner, products reference their store. The seller product list and store profile demonstrate `populate()`.
- **bcrypt:** passwords are one-way hashed before storage and compared at login.
- **JWT:** the verified token identifies the seller for all protected actions.
- **Multi-tenancy:** queries always scope products/stores to the seller's verified identity. A second seller receives `404` for another seller's product rather than information that would help enumerate private records.
- **Multer and image security:** product images accept JPEG, PNG, and WebP, have a 5 MB cap, use random server-generated names, and validate their binary signature in addition to browser-provided MIME type.
- **Async error handling:** async controllers use `await`; unexpected errors pass to one JSON error response handler.

## Create and upload a product

1. Register and log in at `POST /api/auth/register` then `POST /api/auth/login`.
2. Copy the returned `data.token`.
3. Create one store through `POST /api/stores`.
4. Create product metadata as JSON with `POST /api/products`.
5. Upload an image with `POST /api/products/:id/image` and a multipart field named `image`.

In Thunder Client or Postman, add the Authorization header:

```text
Authorization: Bearer <token copied from login>
```

For image upload choose **Body → Form-Data**, add a field named `image`, choose **File**, then select a JPEG, PNG, or WebP below 5 MB.

See [BACKEND_API_CONTRACT.md](BACKEND_API_CONTRACT.md) for every final endpoint, payload, response convention, route parameter, and frontend image URL usage.

## Automated tests

```bash
npm test
npm run verify:studio
```

To seed the controlled Mitti Studio demo record into an authorized database, set private `DEMO_EMAIL` and `DEMO_PASSWORD` environment variables, then run:

```bash
npm run seed:demo
```

The seed command is idempotent, refuses a slug owned by an unrelated seller, adds only its six designated products, and never deletes unrelated records. It intentionally leaves product images blank until owned product images are uploaded.

The test suite starts an isolated `mongodb-memory-server` database and verifies:

- registration, duplicate emails, login, bad passwords, missing/invalid JWTs
- store creation, WhatsApp normalization, and one-store limitation
- product creation, seller filters, update, deletion, dashboard aggregation
- valid/invalid image upload and static image serving
- public storefront filtering
- two-user isolation for updating, deleting, and uploading to another seller's product

The tests do not write data to your local `dukaansaz` database.

## MongoDB Compass verification

1. Start the API and perform registration, store creation, and product creation.
2. Open MongoDB Compass and connect to `mongodb://127.0.0.1:27017`.
3. Open the `dukaansaz` database.
4. Inspect `users`, `stores`, and `products` collections.
5. Confirm `stores.owner` references a user `_id`, `products.store` references a store `_id`, and the `users` documents contain a bcrypt `passwordHash` that API responses never return.

## Image storage

For local development, files go to `uploads/products/` and are served at `/uploads/products/<filename>`. On Vercel, the same upload endpoint stores image bytes persistently in MongoDB GridFS because Vercel does not preserve function files or serve `express.static()`. The API keeps the same `/uploads/products/<filename>` URL contract in both environments.

## Deploy on Vercel

Use this folder as the Vercel project root:

```text
C:\\Users\\Uzair M.Umair\\Documents\\DukaanSaz\\backend
```

`index.js` already default-exports the Express application, which Vercel detects without a custom `vercel.json`. In **Project Settings → Environment Variables**, add these for Production, Preview, and Development as needed:

| Name | Value |
| --- | --- |
| `MONGODB_URI` | A rotated MongoDB Atlas URI ending in `/dukaansaz?retryWrites=true&w=majority` |
| `JWT_SECRET` | A new random secret with at least 32 characters |
| `CLIENT_URL` | The exact deployed React origin, `https://dukaansaz-frontend.vercel.app`. The server also permits `http://localhost:5173` for development. Multiple exact production origins may be comma-separated. |
| `JWT_EXPIRES_IN` | `7d` (optional) |

Do not add `PORT` on Vercel. Do not upload `.env`; `.vercelignore` excludes it. In MongoDB Atlas, create a new database password because any URI pasted into chat should be treated as exposed, and configure **Network Access** so Vercel Functions can reach the cluster.

Vercel Functions limit request and response payloads to 4.5 MB. Although local Multer validation permits 5 MB, hosted multipart uploads must stay below Vercel's limit (roughly 4 MB is a safe frontend cap). For larger production images, move uploads to direct object-storage uploads.

After deployment, verify:

```text
https://YOUR-BACKEND.vercel.app/api/health
```

It should return `success: true` and `status: "ok"`.
