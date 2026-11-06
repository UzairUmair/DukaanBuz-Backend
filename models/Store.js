import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema(
  {
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
