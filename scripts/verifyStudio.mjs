import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import crypto from 'node:crypto';
process.env.JWT_SECRET=crypto.randomBytes(40).toString('hex');
process.env.DEMO_EMAIL='demo@example.invalid';
process.env.DEMO_PASSWORD=crypto.randomBytes(24).toString('hex');
const mongo=await MongoMemoryServer.create();
process.env.MONGODB_URI=mongo.getUri();
const {connectDB}=await import('../config/db.js');
const {default:app}=await import('../index.js');
const {seedDemoStore}=await import('../scripts/seedDemoStore.js');
await connectDB();
try {
 const store=await seedDemoStore();await seedDemoStore();
 const products=await request(app).get('/api/public/stores/mitti-studio-demo/products');
 assert.equal(products.body.data.length,6);
 const login=await request(app).post('/api/auth/login').send({email:process.env.DEMO_EMAIL,password:process.env.DEMO_PASSWORD});
 const token=login.body.data.token;
 const save=await request(app).put('/api/stores/me/appearance').set('Authorization','Bearer '+token).send({primaryColor:'#553322',themePreset:'editorial',heroTitle:'A new collection'});
 assert.equal(save.status,200);
 const refreshed=await request(app).get('/api/public/stores/mitti-studio-demo');
 assert.equal(refreshed.body.data.appearance.primaryColor,'#553322');
 assert.equal((await request(app).put('/api/stores/me/appearance').send({primaryColor:'#000000'})).status,401);
 assert.equal((await request(app).put('/api/stores/me/appearance').set('Authorization','Bearer '+token).send({primaryColor:'url(evil)'})).status,400);
 console.log('PASS demo seed twice, six MongoDB products, appearance save and public refresh, authentication and CSS validation');
} finally {await mongoose.disconnect();await mongo.stop();}
