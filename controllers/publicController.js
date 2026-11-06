import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Store from '../models/Store.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSlug = (value) => String(value || '').trim().toLowerCase();

export const getPublicStore = async (req, res) => {
  const store = await Store.findOne({ slug: normalizeSlug(req.params.slug) }).select(
    'name slug description whatsappNumber city createdAt updatedAt'
  );

  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found', errors: [] });
  }

  res.json({ success: true, message: 'Store retrieved', data: store });
};

export const getPublicProducts = async (req, res) => {
  const store = await Store.findOne({ slug: normalizeSlug(req.params.slug) }).select('_id');
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found', errors: [] });
  }

  const filter = { store: store._id, isActive: true };
  if (req.query.search) {
    const search = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
    filter.$or = [{ title: search }, { description: search }];
  }
  if (req.query.category) {
    filter.category = new RegExp(
      `^${escapeRegex(String(req.query.category).trim())}$`,
      'i'
    );
  }

  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, message: 'Store products retrieved', data: products });
};

export const getPublicProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID', errors: [] });
  }

  const store = await Store.findOne({ slug: normalizeSlug(req.params.slug) }).select('_id');
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found', errors: [] });
  }

  const product = await Product.findOne({
    _id: req.params.id,
    store: store._id,
    isActive: true,
  });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found', errors: [] });
  }

  res.json({ success: true, message: 'Product retrieved', data: product });
};
