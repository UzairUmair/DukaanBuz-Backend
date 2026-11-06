import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import { removeImage, saveImage } from '../config/imageStorage.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSellerStore = (userId) => Store.findOne({ owner: userId }).select('_id');

const buildSellerFilter = (storeId, query) => {
  const filter = { store: storeId };

  if (query.search) {
    const search = new RegExp(escapeRegex(String(query.search).trim()), 'i');
    filter.$or = [{ title: search }, { description: search }];
  }
  if (query.category) {
    filter.category = new RegExp(`^${escapeRegex(String(query.category).trim())}$`, 'i');
  }

  const status = query.status ?? query.isActive;
  if (status === 'active' || status === 'true') filter.isActive = true;
  if (status === 'inactive' || status === 'false') filter.isActive = false;

  if (query.stock === 'inStock') filter.stock = { $gt: 0 };
  if (query.stock === 'outOfStock') filter.stock = 0;

  return filter;
};

const validateProductInput = (body, partial = false) => {
  const errors = [];
  const values = {};

  if (!partial || body.title !== undefined) {
    values.title = typeof body.title === 'string' ? body.title.trim() : '';
    if (values.title.length < 2 || values.title.length > 120) {
      errors.push({ field: 'title', message: 'Title must be 2 to 120 characters' });
    }
  }

  if (body.description !== undefined) {
    values.description =
      typeof body.description === 'string' ? body.description.trim() : '';
    if (values.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description cannot exceed 2000 characters' });
    }
  }

  if (!partial || body.price !== undefined) {
    values.price = typeof body.price === 'number' ? body.price : Number.NaN;
    if (!Number.isFinite(values.price) || values.price < 0) {
      errors.push({ field: 'price', message: 'Price must be a nonnegative number' });
    }
  }

  if (!partial || body.category !== undefined) {
    values.category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!values.category || values.category.length > 80) {
      errors.push({ field: 'category', message: 'Category is required and cannot exceed 80 characters' });
    }
  }

  if (body.stock !== undefined) {
    values.stock = typeof body.stock === 'number' ? body.stock : Number.NaN;
    if (!Number.isInteger(values.stock) || values.stock < 0) {
      errors.push({ field: 'stock', message: 'Stock must be a nonnegative whole number' });
    }
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      errors.push({ field: 'isActive', message: 'isActive must be true or false' });
    } else {
      values.isActive = body.isActive;
    }
  }

  return { errors, values };
};

export const requireOwnedProduct = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid product ID',
      errors: [],
    });
  }

  const store = await getSellerStore(req.user._id);
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found', errors: [] });
  }

  const product = await Product.findOne({ _id: req.params.id, store: store._id });
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found', errors: [] });
  }

  req.product = product;
  next();
};

export const getProducts = async (req, res) => {
  const store = await getSellerStore(req.user._id);
  if (!store) {
    return res.json({ success: true, message: 'Products retrieved', data: [] });
  }

  const products = await Product.find(buildSellerFilter(store._id, req.query))
    .populate('store', 'name slug')
    .sort({ createdAt: -1 });

  res.json({ success: true, message: 'Products retrieved', data: products });
};

export const getProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID', errors: [] });
  }

  const store = await getSellerStore(req.user._id);
  const product = store
    ? await Product.findOne({ _id: req.params.id, store: store._id }).populate(
        'store',
        'name slug'
      )
    : null;

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found', errors: [] });
  }

  res.json({ success: true, message: 'Product retrieved', data: product });
};

export const createProduct = async (req, res) => {
  const store = await getSellerStore(req.user._id);
  if (!store) {
    return res.status(409).json({
      success: false,
      message: 'Create a store before adding products',
      errors: [],
    });
  }

  const { errors, values } = validateProductInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  const product = await Product.create({ ...values, store: store._id });
  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: product,
  });
};

export const updateProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID', errors: [] });
  }

  const store = await getSellerStore(req.user._id);
  const product = store
    ? await Product.findOne({ _id: req.params.id, store: store._id })
    : null;

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found', errors: [] });
  }

  const { errors, values } = validateProductInput(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  if (Object.keys(values).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid product fields were provided',
      errors: [],
    });
  }

  Object.assign(product, values);
  await product.save();

  res.json({ success: true, message: 'Product updated successfully', data: product });
};

export const deleteProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID', errors: [] });
  }

  const store = await getSellerStore(req.user._id);
  const product = store
    ? await Product.findOneAndDelete({ _id: req.params.id, store: store._id })
    : null;

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found', errors: [] });
  }

  await removeImage(product.imageUrl);
  res.json({ success: true, message: 'Product deleted successfully', data: product });
};

export const uploadProductImage = async (req, res, next) => {
  const previousImage = req.product.imageUrl;
  let imageUrl;

  try {
    imageUrl = await saveImage(req.file);
    req.product.imageUrl = imageUrl;
    await req.product.save();
    await removeImage(previousImage);

    res.json({
      success: true,
      message: 'Product image uploaded successfully',
      data: req.product,
    });
  } catch (error) {
    await removeImage(imageUrl);
    next(error);
  }
};
