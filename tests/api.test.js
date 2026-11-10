import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_that_is_safely_longer_than_thirty_two_characters';
process.env.CLIENT_URL = 'https://dukaansaz-frontend.vercel.app';

const { default: app } = await import('../index.js');
const { connectDB, disconnectDB } = await import('../config/db.js');
const { productUploadDirectory } = await import('../middleware/uploadMiddleware.js');

let mongoServer;
let sellerAToken;
let sellerBToken;
let sellerAProductId;

const sellerA = {
  fullName: 'Ayesha Seller',
  email: 'ayesha@example.com',
  password: 'StrongPassword123!',
};
const sellerB = {
  fullName: 'Bilal Seller',
  email: 'bilal@example.com',
  password: 'AnotherPassword123!',
};

const createStore = (token, data) =>
  request(app).post('/api/stores').set('Authorization', `Bearer ${token}`).send(data);

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDB(mongoServer.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  await fs.mkdir(productUploadDirectory, { recursive: true });
});

after(async () => {
  await disconnectDB();
  if (mongoServer) await mongoServer.stop();
});

test('root route returns the public backend status response', async () => {
  const response = await request(app).get('/').expect(200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'DukaanBuz Backend API is running successfully!',
    version: '1.0.0',
  });
});

test('unknown routes return the shared 404 response', async () => {
  const response = await request(app).get('/not-a-real-route').expect(404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Route not found: GET /not-a-real-route');
});

test('malformed JSON uses the error middleware', async () => {
  const response = await request(app).post('/api/auth/login')
    .set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Request body contains invalid JSON');
});

test('health check pings MongoDB and reports safe readiness', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'DukaanSaz API is healthy',
    data: { status: 'ok', database: 'ready' },
  });
});

test('CORS permits the configured frontend and localhost with required headers', async () => {
  for (const origin of ['https://dukaansaz-frontend.vercel.app', 'http://localhost:5173']) {
    const response = await request(app).options('/api/products')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.match(response.headers['access-control-allow-headers'], /Authorization/);
    assert.match(response.headers['access-control-allow-headers'], /Content-Type/);
  }
  const blocked = await request(app).options('/api/products')
    .set('Origin', 'https://untrusted.example')
    .set('Access-Control-Request-Method', 'POST')
    .expect(401);
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);
});

test('registration validates input and rejects duplicate emails', async () => {
  const invalid = await request(app).post('/api/auth/register').send({
    fullName: 'A',
    email: 'not-an-email',
    password: 'short',
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.success, false);

  const created = await request(app).post('/api/auth/register').send(sellerA).expect(201);
  assert.equal(created.body.data.user.email, sellerA.email);
  assert.equal(created.body.data.user.passwordHash, undefined);

  const duplicate = await request(app).post('/api/auth/register').send(sellerA).expect(409);
  assert.equal(duplicate.body.success, false);
});

test('login accepts correct credentials and rejects wrong credentials', async () => {
  const wrong = await request(app)
    .post('/api/auth/login')
    .send({ email: sellerA.email, password: 'WrongPassword123!' })
    .expect(401);
  assert.equal(wrong.body.success, false);

  const login = await request(app).post('/api/auth/login').send({
    email: sellerA.email.toUpperCase(),
    password: sellerA.password,
  });
  assert.equal(login.status, 200);
  sellerAToken = login.body.data.token;
  assert.ok(sellerAToken);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(200);
  assert.equal(me.body.data.user.email, sellerA.email);
});

test('protected endpoints reject missing and invalid JWTs', async () => {
  await request(app).get('/api/stores/me').expect(401);
  const invalid = await request(app)
    .get('/api/stores/me')
    .set('Authorization', 'Bearer invalid.token.value')
    .expect(401);
  assert.equal(invalid.body.success, false);
});

test('sellers can create one store with a normalized Pakistani WhatsApp number', async () => {
  const response = await createStore(sellerAToken, {
    name: 'Ayesha Crafts',
    slug: 'Ayesha Crafts!',
    description: 'Handmade gifts',
    whatsappNumber: '0300-1234567',
    city: 'Karachi',
  }).expect(201);
  assert.equal(response.body.data.slug, 'ayesha-crafts');
  assert.equal(response.body.data.whatsappNumber, '923001234567');

  const duplicate = await createStore(sellerAToken, {
    name: 'A second store',
    whatsappNumber: '+923001234567',
  }).expect(409);
  assert.equal(duplicate.body.success, false);
});

test('appearance settings validate, persist, and are public', async () => {
  const saved = await request(app)
    .put('/api/stores/me/appearance')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({
      themePreset: 'editorial',
      primaryColor: '#553322',
      heroTitle: 'A new collection',
      heroSubtitle: 'Made slowly in Karachi',
      navigationOrder: 'story-first',
      showAbout: 'no',
      showContact: 'yes',
      coverPosition: 'right',
      homeProducts: '6',
    })
    .expect(200);
  assert.equal(saved.body.data.appearance.themePreset, 'editorial');
  assert.equal(saved.body.data.appearance.primaryColor, '#553322');

  const invalidColor = await request(app)
    .put('/api/stores/me/appearance')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({ primaryColor: 'url(javascript:alert(1))' })
    .expect(400);
  assert.equal(invalidColor.body.errors[0].field, 'primaryColor');

  const unsupported = await request(app)
    .put('/api/stores/me/appearance')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({ logoUrl: 'https://example.test/logo.png' })
    .expect(400);
  assert.equal(unsupported.body.errors[0].field, 'logoUrl');

  const publicStore = await request(app).get('/api/public/stores/ayesha-crafts').expect(200);
  assert.equal(publicStore.body.data.appearance.heroTitle, 'A new collection');
  assert.equal(publicStore.body.data.appearance.navigationOrder, 'story-first');
  assert.equal(publicStore.body.data.appearance.showAbout, 'no');
  assert.equal(publicStore.body.data.appearance.coverPosition, 'right');
  assert.equal(publicStore.body.data.appearance.homeProducts, '6');
  await request(app).put('/api/stores/me/appearance')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({ coverPosition: 'arbitrary' }).expect(400);
  assert.equal(publicStore.body.data.appearance.primaryColor, '#553322');
});

test('seller product CRUD, filtering, and dashboard statistics work', async () => {
  const beforeStore = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(200);
  assert.deepEqual(beforeStore.body.data, []);

  const created = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({
      title: 'Handmade Mug',
      description: 'Blue ceramic tea mug',
      price: 1250,
      category: 'Kitchen',
      stock: 3,
    })
    .expect(201);
  sellerAProductId = created.body.data.id;
  assert.equal(created.body.data.price, 1250);

  const filtered = await request(app)
    .get('/api/products?search=ceramic&category=kitchen&stock=inStock&status=active')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(200);
  assert.equal(filtered.body.data.length, 1);
  assert.equal(filtered.body.data[0].store.slug, 'ayesha-crafts');

  const updated = await request(app)
    .put(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({ stock: 0, isActive: false, store: 'cannot-be-changed' })
    .expect(200);
  assert.equal(updated.body.data.stock, 0);
  assert.equal(updated.body.data.isActive, false);

  const stats = await request(app)
    .get('/api/dashboard/stats')
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(200);
  assert.deepEqual(stats.body.data, {
    totalProducts: 1,
    activeProducts: 0,
    outOfStockProducts: 1,
  });
});

test('image uploads verify content, replace images, and reject invalid files', async () => {
  const validPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  const missing = await request(app)
    .post(`/api/products/${sellerAProductId}/image`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(400);
  assert.match(missing.body.message, /image/i);

  const invalid = await request(app)
    .post(`/api/products/${sellerAProductId}/image`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .attach('image', Buffer.from('not an image'), {
      filename: 'pretend.png',
      contentType: 'image/png',
    })
    .expect(400);
  assert.match(invalid.body.message, /valid/i);

  await request(app)
    .post(`/api/products/${sellerAProductId}/image`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), {
      filename: 'oversized.png', contentType: 'image/png',
    })
    .expect(400);

  const uploaded = await request(app)
    .post(`/api/products/${sellerAProductId}/image`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .attach('image', validPng, { filename: 'product.png', contentType: 'image/png' })
    .expect(200);
  assert.match(uploaded.body.data.imageUrl, /^\/uploads\/products\/.+\.png$/);

  const fileResponse = await request(app).get(uploaded.body.data.imageUrl).expect(200);
  assert.equal(fileResponse.headers['content-type'], 'image/png');
});

test('public storefront shows only active products and keeps stores isolated', async () => {
  const firstPublicProduct = await request(app)
    .get(`/api/public/stores/ayesha-crafts/products/${sellerAProductId}`)
    .expect(404);
  assert.equal(firstPublicProduct.body.message, 'Product not found');

  const activeUpdate = await request(app)
    .put(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .send({ isActive: true })
    .expect(200);
  assert.equal(activeUpdate.body.data.isActive, true);

  const storefront = await request(app)
    .get('/api/public/stores/ayesha-crafts/products?search=mug&category=Kitchen')
    .expect(200);
  assert.equal(storefront.body.data.length, 1);
  assert.equal(storefront.body.data[0].id, sellerAProductId);

  await request(app).post('/api/auth/register').send(sellerB).expect(201);
  const sellerBLogin = await request(app).post('/api/auth/login').send({
    email: sellerB.email,
    password: sellerB.password,
  });
  sellerBToken = sellerBLogin.body.data.token;

  await createStore(sellerBToken, {
    name: 'Bilal Clothes',
    whatsappNumber: '+923119876543',
    city: 'Lahore',
  }).expect(201);

  await request(app)
    .put(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerBToken}`)
    .send({ title: 'Stolen Product' })
    .expect(404);

  await request(app)
    .delete(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerBToken}`)
    .expect(404);

  await request(app)
    .post(`/api/products/${sellerAProductId}/image`)
    .set('Authorization', `Bearer ${sellerBToken}`)
    .attach('image', Buffer.from('fake'), {
      filename: 'fake.png',
      contentType: 'image/png',
    })
    .expect(404);

  const sellerBProducts = await request(app)
    .get('/api/products')
    .set('Authorization', `Bearer ${sellerBToken}`)
    .expect(200);
  assert.deepEqual(sellerBProducts.body.data, []);

  await request(app)
    .put('/api/stores/me/appearance')
    .set('Authorization', `Bearer ${sellerBToken}`)
    .send({ primaryColor: '#112233' })
    .expect(200);
  const sellerAPublicStore = await request(app).get('/api/public/stores/ayesha-crafts').expect(200);
  assert.equal(sellerAPublicStore.body.data.appearance.primaryColor, '#553322');
});

test('deleting a product removes its local image and data', async () => {
  const owned = await request(app)
    .get(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(200);
  const filename = path.basename(owned.body.data.imageUrl);

  await request(app)
    .delete(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(200);

  await assert.rejects(fs.access(path.join(productUploadDirectory, filename)));
  await request(app)
    .get(`/api/products/${sellerAProductId}`)
    .set('Authorization', `Bearer ${sellerAToken}`)
    .expect(404);

  assert.equal(mongoose.connection.readyState, 1);
});
