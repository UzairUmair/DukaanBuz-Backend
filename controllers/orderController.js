import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Order, { SubmissionWindow } from '../models/Order.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const summary = order => ({ orderNumber: order.orderNumber, status: order.status, totalAmount: order.totalAmount });
const clean = (value, maximum, required = false) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > maximum ||
      (required && !value.trim()) || /[<>\x00-\x1f]/.test(value)) fail('Invalid customer details');
  return value.trim();
};

export async function createOrder(req, res) {
  await Order.init();
  const store = await Store.findOne({ slug: String(req.params.slug).toLowerCase() });
  if (!store) fail('Store not found', 404);
  if (Buffer.byteLength(JSON.stringify(req.body)) > 16000) fail('Order request is too large', 413);
  const { customer, items, idempotencyKey } = req.body;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) fail('Customer details are required');
  if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{20,100}$/.test(idempotencyKey)) fail('A valid request key is required');
  if (!Array.isArray(items) || !items.length || items.length > 30) fail('Choose between 1 and 30 products');
  const ids = new Set();
  for (const item of items) {
    if (!item || !mongoose.isValidObjectId(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || ids.has(item.productId)) fail('Invalid product quantities');
    ids.add(item.productId);
  }
  const details = {
    customerName: clean(customer.name, 80, true),
    customerPhone: clean(customer.phone, 24, true),
    customerCity: clean(customer.city, 80),
    deliveryAddress: clean(customer.address, 500),
    customerNotes: clean(customer.notes, 1000),
  };
  if (!/^\+?[0-9 ()-]{7,24}$/.test(details.customerPhone)) fail('Enter a valid contact phone number');
  const requestHash = hash(JSON.stringify({ details, items }));
  const requestKey = hash(idempotencyKey);
  const existing = await Order.findOne({ store: store._id, requestKey }).select('+requestHash');
  if (existing) {
    if (existing.requestHash !== requestHash) fail('This request key was used for a different order', 409);
    return res.json({ success: true, data: summary(existing) });
  }
  const bucket = Math.floor(Date.now() / 600000);
  const windowId = hash(String(req.ip) + ':' + bucket);
  const window = await SubmissionWindow.findOneAndUpdate({ _id: windowId }, {
    $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 1200000) },
  }, { upsert: true, new: true });
  if (window.count > 20) fail('Too many order requests. Please try again later.', 429);

  const products = await Product.find({ _id: { $in: [...ids] }, store: store._id, isActive: true });
  if (products.length !== items.length) fail('One or more products are unavailable in this store');
  const snapshots = items.map(item => {
    const product = products.find(product => String(product._id) === item.productId);
    if (product.stock < item.quantity) fail('Insufficient stock for ' + product.title, 409);
    if (!Number.isFinite(product.price) || product.price < 0 || product.price > 100000000) fail('Product price is unavailable', 409);
    const unitPrice = Math.round(product.price * 100) / 100;
    return { product: product._id, productTitle: product.title, imageUrl: product.imageUrl, unitPrice, quantity: item.quantity, lineSubtotal: Math.round(unitPrice * 100) * item.quantity / 100 };
  });
  const total = snapshots.reduce((sum, item) => sum + Math.round(item.lineSubtotal * 100), 0) / 100;
  try {
    const order = await Order.create({ store: store._id, requestKey, requestHash,
      orderNumber: 'DS-' + crypto.randomBytes(8).toString('hex').toUpperCase(),
      ...details, items: snapshots, subtotal: total, totalAmount: total });
    res.status(201).json({ success: true, data: summary(order) });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const replay = await Order.findOne({ store: store._id, requestKey }).select('+requestHash');
    if (!replay || replay.requestHash !== requestHash) fail('Conflicting order request', 409);
    res.json({ success: true, data: summary(replay) });
  }
}

async function sellerStore(req) {
  const store = await Store.findOne({ owner: req.user._id }).select('_id');
  if (!store) fail('Create a store first', 404);
  return store._id;
}
export async function listOrders(req, res) {
  const store = await sellerStore(req);
  const filter = { store };
  if (req.query.status) {
    if (!['pending','confirmed','processing','completed','rejected'].includes(req.query.status)) fail('Invalid status');
    filter.status = req.query.status;
  }
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  if (req.query.search) filter.orderNumber = { $regex: String(req.query.search).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: req.query.sort === 'oldest' ? 1 : -1 }).skip((page - 1) * 20).limit(20), Order.countDocuments(filter)]);
  res.json({ success: true, data: { orders, total, page, pages: Math.ceil(total / 20) } });
}
export async function orderStats(req, res) {
  const store = await sellerStore(req);
  const counts = await Order.aggregate([{ $match: { store } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const result = { totalOrders: 0, pendingOrders: 0, confirmedOrders: 0, processingOrders: 0, completedOrders: 0, rejectedOrders: 0 };
  for (const row of counts) { result[row._id + 'Orders'] = row.count; result.totalOrders += row.count; }
  res.json({ success: true, data: result });
}
export async function getOrder(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) fail('Invalid order ID');
  const order = await Order.findOne({ _id: req.params.id, store: await sellerStore(req) });
  if (!order) fail('Order not found', 404);
  res.json({ success: true, data: order });
}
export async function changeStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) fail('Invalid order ID');
  const store = await sellerStore(req);
  const transitions = { pending: ['confirmed','rejected'], confirmed: ['processing'], processing: ['completed'] };
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.id, store }).session(session);
      if (!order) fail('Order not found', 404);
      if (order.status === req.body.status) { result = order; return; }
      if (!transitions[order.status]?.includes(req.body.status)) fail('This status transition is not allowed', 409);
      if (req.body.status === 'confirmed') {
        for (const item of order.items) {
          const update = await Product.updateOne({ _id: item.product, store, isActive: true, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session });
          if (update.modifiedCount !== 1) fail('A product is unavailable or has insufficient stock', 409);
        }
      }
      order.status = req.body.status;
      await order.save({ session });
      result = order;
    });
  } finally { await session.endSession(); }
  res.json({ success: true, data: result });
}
