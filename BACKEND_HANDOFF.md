# DukaanSaz frontend backend handoff

## Base URL

- **Production:** `https://dukaanbuz-backend.vercel.app/api`
- **Local:** `http://localhost:5000/api`

All JSON responses use this envelope:

```json
{ "success": true, "message": "Operation completed", "data": {} }
```

Errors use:

```json
{
  "success": false,
  "message": "Clear error message",
  "errors": [{ "field": "fieldName", "message": "Reason" }]
}
```

## Authentication

Use the token returned by `POST /auth/login` with every seller endpoint:

```http
Authorization: Bearer <token>
```

| Method | Endpoint | Request | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ "fullName", "email", "password" }` | Password: 8–72 UTF-8 bytes. |
| POST | `/auth/login` | `{ "email", "password" }` | Returns `data.token` and safe `data.user`. |
| GET | `/auth/me` | — | Requires bearer token. |

User responses never include `passwordHash`.

## Stores and Design Studio

| Method | Endpoint | Request | Notes |
| --- | --- | --- | --- |
| GET | `/stores/me` | — | Current seller store, or `data: null`. |
| POST | `/stores` | `{ "name", "slug?", "description?", "whatsappNumber", "city?" }` | One store per seller. |
| PUT | `/stores/me` | Any editable store fields | Seller-owned store only. |
| PUT | `/stores/me/appearance` | Appearance fields below | Seller-owned store only. |
| GET | `/public/stores/:slug` | — | Public store and published appearance. |

`PUT /stores/me/appearance` accepts one or more of these string fields. Unsupported keys, non-string values, invalid choices, invalid colors, and oversized text return `400` with field-level errors.

```json
{
  "themePreset": "heritage",
  "primaryColor": "#063D32",
  "accentColor": "#A7E2BD",
  "backgroundColor": "#FAF8F3",
  "fontPreset": "inter",
  "headerStyle": "minimal",
  "productCardStyle": "soft",
  "gridDensity": "comfortable",
  "heroLayout": "split",
  "heroTitle": "",
  "heroSubtitle": ""
}
```

Allowed values:

- `themePreset`: `heritage`, `editorial`, `modern`
- `fontPreset`: `inter`, `manrope`, `jakarta`
- `headerStyle`: `minimal`, `centered`, `editorial`
- `productCardStyle`: `minimal`, `soft`, `editorial`
- `gridDensity`: `compact`, `comfortable`, `spacious`
- `heroLayout`: `split`, `banner`, `minimal`
- color values: six-digit hex (`#RRGGBB`)
- `heroTitle`: up to 120 characters; `heroSubtitle`: up to 500 characters

Dedicated logo and banner upload fields/endpoints are **not implemented** in this contract. The current Design Studio uses uploaded product images for visual merchandising.

## Products and images

| Method | Endpoint | Request | Notes |
| --- | --- | --- | --- |
| GET | `/products` | Query: `search`, `category`, `stock`, `status` | Seller-owned products only. |
| GET | `/products/:id` | — | Seller-owned product only. |
| POST | `/products` | `{ "title", "description?", "price", "category", "stock?", "isActive?" }` | Create for current seller store. |
| PUT | `/products/:id` | Editable product fields | `store` from client JSON is ignored. |
| DELETE | `/products/:id` | — | Removes the image record too. |
| POST | `/products/:id/image` | `multipart/form-data`, field `image` | JPEG, PNG, or WebP only. |
| GET | `/public/stores/:slug/products` | Query: `search`, `category` | Active products only. |
| GET | `/public/stores/:slug/products/:id` | — | Active product in that store only. |

Images must be at most 5 MB by API validation and must have a matching JPEG, PNG, or WebP binary signature. The Vercel request limit is lower, so the frontend should cap production uploads at **4 MB**.

The upload response has a relative `imageUrl`, for example:

```json
{ "imageUrl": "/uploads/products/507f1f77bcf86cd799439011.webp" }
```

Resolve it from the API origin, not the `/api` prefix:

```js
const imageUrl = new URL(product.imageUrl, 'https://dukaanbuz-backend.vercel.app').href;
```

Locally, image files use `uploads/products`. On Vercel, image bytes are persistent MongoDB GridFS records and keep the same public relative URL shape.

## Dashboard and readiness

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/dashboard/stats` | Authenticated seller totals for `totalProducts`, `activeProducts`, and `outOfStockProducts`. |
| GET | `/health` | `200` with `{ "status": "ok", "database": "ready" }` only after a database ping. Returns `503` with a safe unavailable state when MongoDB cannot be reached. |

## CORS and environment

The backend permits `http://localhost:5173` plus the exact comma-separated origins in the backend Vercel project's private `CLIENT_URL` setting. It accepts `Authorization` and `Content-Type` preflight headers. The frontend production origin must be added exactly; wildcard origins are intentionally not used.

Required Vercel environment settings are private: `MONGODB_URI`, `JWT_SECRET` (32+ characters), `CLIENT_URL`, and `JWT_EXPIRES_IN`. The controlled demo seed also needs `DEMO_EMAIL` and `DEMO_PASSWORD`; it is run privately with `npm run seed:demo`, never through a public API.

## Status codes

- `200`: successful fetch, update, delete, upload, or readiness check
- `201`: registration, store creation, or product creation
- `400`: validation, malformed JSON, invalid identifier, or invalid file
- `401`: missing, invalid, or expired bearer token
- `404`: missing resource or a resource outside the seller tenancy
- `409`: duplicate email/store/slug or a product created without a store
- `503`: database/backend dependency unavailable
- `500`: unexpected server failure
