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
 assert.deepEqual(products.body.data.map(product=>[product.title,product.category,product.price,product.stock]).sort(),[
  ['Artisan Cup Set','Drinkware',2850,10],
  ['Ceramic Serving Plate','Tableware',2400,8],
  ['Glazed Ceramic Bowl','Tableware',1750,12],
  ['Handmade Coffee Mug','Drinkware',950,20],
  ['Minimal Clay Planter','Home Decor',1150,15],
  ['Terracotta Flower Vase','Home Decor',2200,6],
 ].sort());
 assert.ok(products.body.data.every(product=>product.imageUrl===''));
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
