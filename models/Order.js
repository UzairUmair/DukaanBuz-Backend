import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  orderNumber: { type: String, required: true, unique: true },
  requestKey: { type: String, required: true, select: false },
  requestHash: { type: String, required: true, select: false },
  customerName: { type: String, required: true, maxlength: 80 },
  customerPhone: { type: String, required: true, maxlength: 24 },
  customerCity: { type: String, maxlength: 80 },
  deliveryAddress: { type: String, maxlength: 500 },
  customerNotes: { type: String, maxlength: 1000 },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productTitle: String, imageUrl: String, unitPrice: Number,
    quantity: Number, lineSubtotal: Number,
  }],
  subtotal: Number,
  totalAmount: Number,
  status: { type: String, enum: ['pending','confirmed','processing','completed','rejected'], default: 'pending' },
}, { timestamps: true });
orderSchema.index({ store: 1, requestKey: 1 }, { unique: true });
orderSchema.index({ store: 1, status: 1, createdAt: -1 });
export default mongoose.model('Order', orderSchema);

const submissionSchema = new mongoose.Schema({
  _id: String, count: Number, expiresAt: Date,
});
submissionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SubmissionWindow = mongoose.model('SubmissionWindow', submissionSchema);
