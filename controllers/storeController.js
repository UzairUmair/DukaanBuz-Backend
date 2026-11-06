import Store from '../models/Store.js';

const reservedSlugs = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'login',
  'register',
  'stores',
  'products',
  'public',
  'uploads',
  'www',
]);

const makeSlug = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

const normalizeWhatsappNumber = (value) => {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('0092')) digits = digits.slice(2);
  if (digits.startsWith('03')) digits = `92${digits.slice(1)}`;
  if (/^3\d{9}$/.test(digits)) digits = `92${digits}`;

  return /^923\d{9}$/.test(digits) ? digits : null;
};

const validateStoreInput = (body, partial = false) => {
  const errors = [];
  const values = {};

  if (!partial || body.name !== undefined) {
    values.name = typeof body.name === 'string' ? body.name.trim() : '';
    if (values.name.length < 2 || values.name.length > 80) {
      errors.push({ field: 'name', message: 'Store name must be 2 to 80 characters' });
    }
  }

  if (!partial || body.slug !== undefined) {
    values.slug = makeSlug(body.slug || body.name);
    if (values.slug.length < 3 || reservedSlugs.has(values.slug)) {
      errors.push({ field: 'slug', message: 'Choose a valid, non-reserved store slug' });
    }
  }

  if (!partial || body.whatsappNumber !== undefined) {
    values.whatsappNumber = normalizeWhatsappNumber(body.whatsappNumber);
    if (!values.whatsappNumber) {
      errors.push({
        field: 'whatsappNumber',
        message: 'Enter a Pakistani mobile number such as 03001234567 or +923001234567',
      });
    }
  }

  if (body.description !== undefined) {
    values.description =
      typeof body.description === 'string' ? body.description.trim() : '';
    if (values.description.length > 500) {
      errors.push({ field: 'description', message: 'Description cannot exceed 500 characters' });
    }
  }

  if (body.city !== undefined) {
    values.city = typeof body.city === 'string' ? body.city.trim() : '';
    if (values.city.length > 80) {
      errors.push({ field: 'city', message: 'City cannot exceed 80 characters' });
    }
  }

  return { errors, values };
};

export const getMyStore = async (req, res) => {
  const store = await Store.findOne({ owner: req.user._id }).populate(
    'owner',
    'fullName email'
  );

  res.json({
    success: true,
    message: store ? 'Store retrieved' : 'No store has been created yet',
    data: store,
  });
};

export const createStore = async (req, res) => {
  if (await Store.exists({ owner: req.user._id })) {
    return res.status(409).json({
      success: false,
      message: 'This seller already has a store',
      errors: [],
    });
  }

  const { errors, values } = validateStoreInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  const store = await Store.create({ ...values, owner: req.user._id });
  res.status(201).json({
    success: true,
    message: 'Store created successfully',
    data: store,
  });
};

export const updateMyStore = async (req, res) => {
  const store = await Store.findOne({ owner: req.user._id });
  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
      errors: [],
    });
  }

  const { errors, values } = validateStoreInput(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  if (Object.keys(values).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid store fields were provided',
      errors: [],
    });
  }

  Object.assign(store, values);
  await store.save();

  res.json({ success: true, message: 'Store updated successfully', data: store });
};
