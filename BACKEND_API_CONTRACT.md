# DukaanSaz Backend API Contract

**Base URL (development):** `http://localhost:5000`
**API prefix:** `/api`
**Content type:** `application/json`, except image upload.

Every API reply has this shape:

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "message": "Clear error message",
  "errors": [{ "field": "email", "message": "Email is already registered" }]
}
```

## Authentication

Protected endpoints require this header:

```http
Authorization: Bearer <JWT token>
```

Tokens are signed with `JWT_SECRET`, use HS256, and expire after `JWT_EXPIRES_IN` (seven days by default). The backend determines the seller from the verified token. It never trusts a `userId`, `owner`, or `store` value supplied by the client.

| Method | Endpoint | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | `{ "fullName", "email", "password" }`; password minimum: 8 characters |
| POST | `/api/auth/login` | No | `{ "email", "password" }`; returns `data.token` and `data.user` |
| GET | `/api/auth/me` | Yes | Returns the safe user profile |

A user object never includes `passwordHash`.

## Store endpoints

| Method | Endpoint | Auth | Body / notes |
| --- | --- | --- | --- |
| GET | `/api/stores/me` | Yes | `data` is `null` when no store exists |
| POST | `/api/stores` | Yes | `{ "name", "slug?", "description?", "whatsappNumber", "city?" }` |
| PUT | `/api/stores/me` | Yes | Any editable store fields |
| PUT | `/api/stores/me/appearance` | Yes | One or more validated appearance fields listed below |

### Store appearance

The Design Studio persists this seller-owned structure and public store responses include it:

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

Supported theme presets are `heritage`, `editorial`, and `modern`; font presets are `inter`, `manrope`, and `jakarta`; headers are `minimal`, `centered`, and `editorial`; product cards are `minimal`, `soft`, and `editorial`; grid density is `compact`, `comfortable`, or `spacious`; and hero layouts are `split`, `banner`, or `minimal`. Colors must be six-digit hex values. Hero title/subtitle lengths are limited to 120/500 characters. Unsupported fields, including `logoUrl` and `heroImageUrl`, return field-level validation errors because dedicated logo and banner upload support is not currently implemented.

Only one store may belong to one seller in this MVP. Slugs are normalized to lowercase kebab case. Reserved slugs (such as `api`, `admin`, and `uploads`) are rejected. `whatsappNumber` accepts formats such as `03001234567` and `+923001234567`, then stores the normalized form `923001234567`.

## Seller product endpoints

`id` below is the MongoDB product ID returned as `product.id`.

| Method | Endpoint | Auth | Body / notes |
| --- | --- | --- | --- |
| GET | `/api/products` | Yes | Query options: `search`, `category`, `stock=inStock\|outOfStock`, `status=active\|inactive` (also `isActive=true\|false`) |
| GET | `/api/products/:id` | Yes | Gets a product owned by the signed-in seller |
| POST | `/api/products` | Yes | `{ "title", "description?", "price", "category", "stock?", "isActive?" }` |
| PUT | `/api/products/:id` | Yes | Any editable product fields. `store` from request JSON is ignored. |
| DELETE | `/api/products/:id` | Yes | Deletes an owned product and its local image when present |
| POST | `/api/products/:id/image` | Yes | `multipart/form-data`, field name exactly `image` |

Example create-product request:

```json
{
  "title": "Handmade Mug",
  "description": "Blue ceramic tea mug",
  "price": 1250,
  "category": "Kitchen",
  "stock": 3
}
```

Prices are Pakistani rupees (PKR). `price` is nonnegative; `stock` is a nonnegative whole number.

### Image URLs

The upload endpoint accepts JPEG, PNG, or WebP only. It has a 5 MB limit and validates MIME type **and file signatures**. The response gives a relative URL, for example:

```json
{ "imageUrl": "/uploads/products/1730000000000-uuid.png" }
```

For the React frontend, use it as:

```js
const fullImageUrl = `http://localhost:5000${product.imageUrl}`;
```

Local development stores images in `uploads/products`. On Vercel, the backend stores images persistently in MongoDB GridFS while preserving the same URL shape. Vercel's 4.5 MB function payload limit applies before the API's 5 MB Multer limit, so the hosted frontend should cap uploads at about 4 MB. At larger production scale, direct uploads to object storage are preferable.

## Public storefront endpoints

`slug` is the store slug. Public results disclose only active products belonging to that exact store.

| Method | Endpoint | Query options |
| --- | --- | --- |
| GET | `/api/public/stores/:slug` | None |
| GET | `/api/public/stores/:slug/products` | `search`, `category` |
| GET | `/api/public/stores/:slug/products/:id` | None |

## Dashboard and health

| Method | Endpoint | Auth | Result |
| --- | --- | --- | --- |
| GET | `/api/dashboard/stats` | Yes | `totalProducts`, `activeProducts`, `outOfStockProducts` |
| GET | `/api/health` | No | Performs a MongoDB ping; `200` includes `{ "status": "ok", "database": "ready" }`, and safe `503` otherwise |

## Data schemas

### User

`id`, `fullName`, `email`, `role` (`seller`), `createdAt`, `updatedAt`. Its MongoDB record additionally has a bcrypt `passwordHash`, which API responses exclude.

### Store

`id`, `owner` (User ObjectId), `name`, `slug`, `description`, `whatsappNumber`, `city`, timestamps. `/api/stores/me` uses `populate()` to return basic owner information; the database relation remains an ObjectId reference.

### Product

`id`, `store` (Store ObjectId or populated basic store on seller listing), `title`, `description`, `price`, `category`, `stock`, `imageUrl`, `isActive`, timestamps.

## Status-code guide

- `200` successful retrieval/update/deletion/upload
- `201` resource created
- `400` malformed route ID, invalid request JSON, validation, or invalid upload
- `401` absent, invalid, or expired token
- `404` missing route/resource or resource outside the seller's tenancy
- `409` duplicate email/store/slug or product attempted before creating a store
- `500` unexpected server error
