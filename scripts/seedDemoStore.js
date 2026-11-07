import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Store from '../models/Store.js';
import Product from '../models/Product.js';

export async function seedDemoStore() {
  const { DEMO_EMAIL: email, DEMO_PASSWORD: password } = process.env;
  if (!email || !password || password.length < 12) throw new Error('Set DEMO_EMAIL and a DEMO_PASSWORD of at least 12 characters.');
  let user = await User.findOne({ email: email.toLowerCase() });
  let store = await Store.findOne({ slug: 'mitti-studio-demo' });
  if (store && (!user || !store.owner.equals(user._id) || !store.isDemo)) throw new Error('Demo slug is occupied by an unrelated store.');
  if (user && !store) throw new Error('Use a new designated demo email.');
  if (!user) user = await User.create({ fullName: 'Mitti Studio Demo Seller', email, passwordHash: await bcrypt.hash(password, 12) });
  if (!store) store = await Store.create({ owner: user._id, name: 'Mitti Studio', slug: 'mitti-studio-demo', isDemo: true, whatsappNumber: '923000000000', city: 'Karachi, Pakistan', description: 'Explore thoughtfully crafted ceramics, tableware, and home accessories inspired by timeless craftsmanship.', appearance: { heroTitle: 'Handcrafted pieces for beautiful everyday living.' } });
  const items = [
    ['Glazed Ceramic Bowl','Tableware',1750,12,'A beautifully glazed ceramic bowl, handcrafted for everyday dining and special occasions.','bowl.webp'],
    ['Handmade Coffee Mug','Drinkware',950,20,'A minimal handmade coffee mug with a natural textured finish and comfortable handle.','cup.webp'],
    ['Ceramic Serving Plate','Tableware',2400,8,'A refined ceramic serving plate designed for beautifully presented meals.','ceramics.jpg'],
    ['Terracotta Flower Vase','Home Decor',2200,6,'A warm terracotta vase that brings timeless character to modern interiors.','jug.webp'],
    ['Minimal Clay Planter','Home Decor',1150,15,'A simple, versatile clay planter for adding a natural touch to your home.','vessels.webp'],
    ['Artisan Cup Set','Drinkware',2850,10,'A coordinated collection of handcrafted ceramic cups with a unique artisan finish.','ceramics.jpg'],
  ];
  for (const [title,category,price,stock,description,image] of items) {
    await Product.updateOne({ store: store._id, title }, { $setOnInsert: { store: store._id, title, category, price, stock, description, imageUrl: 'https://dukaansaz-frontend.vercel.app/editorial/'+image, isActive: true } }, { upsert: true, runValidators: true });
  }
  return store;
}
if (process.argv[1]?.endsWith('seedDemoStore.js')) {
  try { await connectDB(); await seedDemoStore(); console.log('Demo store seeded safely.'); }
  finally { await mongoose.disconnect(); }
}

