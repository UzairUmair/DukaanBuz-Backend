# Commerce API and inventory policy

Guest checkout uses POST /api/public/stores/:slug/orders. The JSON body contains customer { name, phone, city?, address?, notes? }, items [{ productId, quantity }] and idempotencyKey (a UUID). Name and contact phone are required. Delivery details are optional because the seller confirms fulfillment and charges after reviewing the request.

The response contains only orderNumber, status and totalAmount. Successful initial submission returns 201. An identical request with the same key returns 200 and the original confirmation. Reusing that key with different customer/items data returns 409. No public order lookup or listing exists.

Carts persist only product IDs and quantities in per-store localStorage. Checkout retrieves current active products and the server independently validates ownership, availability and prices. Buy Now uses a separate selected-item checkout and leaves other cart items untouched. Request keys persist across checkout retries in sessionStorage with a SHA-256 request fingerprint. Customer fields are kept in component memory.

Seller endpoints require JWT authentication:
- GET /api/orders?status=pending&page=1&sort=newest&search=DS-...
- GET /api/orders/stats
- GET /api/orders/:id
- PUT /api/orders/:id/status with { status }

Lists contain 20 records per page. Seller queries always resolve the store from the verified user. The orders collection indexes store/requestKey uniquely and store/status/date for listing. Guest submission counters use MongoDB with a TTL index, allowing 20 attempts per client IP per ten-minute window. Public order payloads are limited to 16 KB, 30 distinct products and quantities 1–99. Existing Express body limits apply before route validation.

## Inventory

Pending orders validate stock without reserving or deducting it. Confirming uses a MongoDB transaction to recheck every item and deduct stock atomically. Concurrent confirmations cannot oversell or deduct twice. The allowed lifecycle is pending → confirmed → processing → completed, or pending → rejected. Repeating the current status is a safe no-op. Rejection after confirmation and cancellation are unavailable, so no stock-restoration path is needed for this lifecycle. MongoDB transactions require Atlas or a replica set. No payment is collected or recorded as paid.

## Verification

The order integration suite uses a temporary MongoDB replica set and two sellers. It covers authoritative totals, duplicate requests, stock checking, inactive/cross-store products, seller isolation, invalid IDs, status transitions and simultaneous confirmations competing for stock.

The browser suite used two isolated stores and checked cart persistence, item removal, quantities, checkout persistence, receipt, cleanup, seller fulfillment, Buy Now and mobile rendering. Screenshots are in frontend/docs/commerce-checks.

Production smoke verification should use only designated test products. A pending request can be rejected without changing stock. Real customer orders must remain untouched.
