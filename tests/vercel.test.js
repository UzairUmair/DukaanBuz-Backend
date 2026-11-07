import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.JWT_SECRET = 'test_secret_that_is_safely_longer_than_thirty_two_characters';
process.env.CLIENT_URL = 'http://localhost:5173';

let app;
let mongoServer;
let token;
let productId;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  ({ default: app } = await import('../index.js'));
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  delete process.env.VERCEL;
});

test('root route stays connection-free while health verifies Vercel database readiness', async () => {
  assert.equal(mongoose.connection.readyState, 0);
  const root = await request(app).get('/').expect(200);
  assert.equal(mongoose.connection.readyState, 0);
  assert.deepEqual(root.body, {
    success: true,
    message: 'DukaanBuz Backend API is running successfully!',
    version: '1.0.0',
  });
  const health = await request(app).get('/api/health').expect(200);
  assert.deepEqual(health.body.data, { status: 'ok', database: 'ready' });
  assert.equal(mongoose.connection.readyState, 1);
});

test('Vercel mode rejects a short JWT secret without weakening validation', async () => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'too-short';
  try {
    await request(app).get('/api/health').expect(503);
  } finally {
    process.env.JWT_SECRET = secret;
  }
});

test('Vercel mode connects lazily and persists product images in GridFS', async () => {

  await request(app).post('/api/auth/register').send({
    fullName: 'Vercel Seller',
    email: 'vercel@example.com',
    password: 'StrongPassword123!',
  }).expect(201);

  const login = await request(app).post('/api/auth/login').send({
    email: 'vercel@example.com',
    password: 'StrongPassword123!',
  }).expect(200);
  token = login.body.data.token;

  await request(app)
    .post('/api/stores')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Hosted Store', whatsappNumber: '+923001234567' })
    .expect(201);

  const created = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Hosted Mug', price: 1500, category: 'Kitchen', stock: 2 })
    .expect(201);
  productId = created.body.data.id;

  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const uploaded = await request(app)
    .post(`/api/products/${productId}/image`)
    .set('Authorization', `Bearer ${token}`)
    .attach('image', png, { filename: 'hosted.png', contentType: 'image/png' })
    .expect(200);

  assert.match(uploaded.body.data.imageUrl, /^\/uploads\/products\/[a-f\d]{24}\.png$/);
  const image = await request(app).get(uploaded.body.data.imageUrl).expect(200);
  assert.equal(image.headers['content-type'], 'image/png');
  assert.deepEqual(image.body, png);

  const storedFiles = await mongoose.connection.db.collection('productImages.files').countDocuments();
  assert.equal(storedFiles, 1);

  await request(app)
    .delete(`/api/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(await mongoose.connection.db.collection('productImages.files').countDocuments(), 0);
});
