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

const appearanceOptions = {
  navigationOrder: new Set(['standard','story-first']),
  showAbout: new Set(['yes','no']),
  showContact: new Set(['yes','no']),
  coverPosition: new Set(['left','right']),
  homeProducts: new Set(['3','6','9','0']),
  logoPosition: new Set(['beside','above']),
  themePreset: new Set(['heritage', 'editorial', 'modern']),
  fontPreset: new Set(['inter', 'manrope', 'jakarta']),
  headerStyle: new Set(['minimal', 'centered', 'editorial']),
  productCardStyle: new Set(['minimal', 'soft', 'editorial']),
  gridDensity: new Set(['compact', 'comfortable', 'spacious']),
  heroLayout: new Set(['split', 'banner', 'minimal']),
};
const appearanceTextLimits = { heroTitle: 120, heroSubtitle: 500 };
const colorPattern = /^#[0-9a-f]{6}$/i;

const validateAppearanceInput = (body) => {
  const errors = [];
  const values = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [{ field: 'appearance', message: 'Appearance must be a JSON object' }], values };
  }

  for (const [field, value] of Object.entries(body)) {
    if (field === 'brandLogo') {
      if (value === '') { values.brandLogo = ''; continue; }
      const prefix = 'data:image/webp;base64,';
      const encoded = typeof value === 'string' && value.length <= 90000 && value.startsWith(prefix) ? value.slice(prefix.length) : '';
      const bytes = Buffer.from(encoded, 'base64');
      if (!encoded || bytes.toString('base64') !== encoded || bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WEBP') errors.push({field,message:'Choose a valid WebP business logo.'});
      else values.brandLogo = value;
      continue;
    }
    if (!Object.hasOwn(appearanceOptions, field) && !Object.hasOwn(appearanceTextLimits, field) && !['primaryColor', 'accentColor', 'backgroundColor'].includes(field)) {
      errors.push({ field, message: 'This appearance field is not supported' });
      continue;
    }
    if (typeof value !== 'string') {
      errors.push({ field, message: 'Appearance values must be strings' });
      continue;
    }

    const trimmed = value.trim();
    if (appearanceOptions[field] && !appearanceOptions[field].has(trimmed)) {
      errors.push({ field, message: 'Unsupported appearance option' });
    } else if (['primaryColor', 'accentColor', 'backgroundColor'].includes(field) && !colorPattern.test(trimmed)) {
      errors.push({ field, message: 'Color must be a six-digit hex value such as #063D32' });
    } else if (appearanceTextLimits[field] !== undefined && trimmed.length > appearanceTextLimits[field]) {
      errors.push({ field, message: `Text cannot exceed ${appearanceTextLimits[field]} characters` });
    } else {
      values[field] = trimmed;
    }
  }

  return { errors, values };
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

export const updateAppearance = async (req, res) => {
  const store = await Store.findOne({ owner: req.user._id });
  if (!store) {
    return res.status(404).json({ success: false, message: 'Store not found', errors: [] });
  }

  const { errors, values } = validateAppearanceInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  if (Object.keys(values).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Provide at least one appearance field',
      errors: [],
    });
  }

  store.appearance = { ...store.appearance.toObject(), ...values };
  await store.save();
  res.json({ success: true, message: 'Store appearance updated successfully', data: store });
};
