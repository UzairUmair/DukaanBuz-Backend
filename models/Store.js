import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema(
  {
    isDemo: { type: Boolean, default: false },
    appearance: {
      themePreset: { type: String, enum: ['heritage','editorial','modern'], default: 'heritage' },
      fontPreset: { type: String, enum: ['inter','manrope','jakarta'], default: 'inter' },
      headerStyle: { type: String, enum: ['minimal','centered','editorial'], default: 'minimal' },
      productCardStyle: { type: String, enum: ['minimal','soft','editorial'], default: 'soft' },
      gridDensity: { type: String, enum: ['compact','comfortable','spacious'], default: 'comfortable' },
      heroLayout: { type: String, enum: ['split','banner','minimal'], default: 'split' },
      primaryColor: { type: String, match: /^#[0-9a-f]{6}$/i, default: '#063D32' },
      accentColor: { type: String, match: /^#[0-9a-f]{6}$/i, default: '#A7E2BD' },
      backgroundColor: { type: String, match: /^#[0-9a-f]{6}$/i, default: '#FAF8F3' },
      brandLogo: { type: String, maxlength: 90000, default: '' },
      navigationOrder: { type: String, enum: ['standard','story-first'], default: 'standard' },
      showAbout: { type: String, enum: ['yes','no'], default: 'yes' },
      showContact: { type: String, enum: ['yes','no'], default: 'yes' },
      coverPosition: { type: String, enum: ['left','right'], default: 'left' },
      homeProducts: { type: String, enum: ['3','6','9','0'], default: '3' },
      logoPosition: { type: String, enum: ['beside','above'], default: 'beside' },
      heroTitle: { type: String, maxlength: 120, default: '' },
      heroSubtitle: { type: String, maxlength: 500, default: '' },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [2, 'Store name must be at least 2 characters'],
      maxlength: [80, 'Store name cannot exceed 80 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Store slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Store slug must be at least 3 characters'],
      maxlength: [60, 'Store slug cannot exceed 60 characters'],
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Store slug is invalid'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    whatsappNumber: {
      type: String,
      required: [true, 'WhatsApp number is required'],
      match: [/^923\d{9}$/, 'WhatsApp number is invalid'],
    },
    city: {
      type: String,
      trim: true,
      maxlength: [80, 'City cannot exceed 80 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

storeSchema.set('toJSON', {
  transform: (_document, object) => {
    object.id = object._id.toString();
    delete object._id;
    delete object.__v;
    return object;
  },
});

const Store = mongoose.model('Store', storeSchema);
export default Store;
