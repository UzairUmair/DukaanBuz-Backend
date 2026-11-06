import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  requireOwnedProduct,
  updateProduct,
  uploadProductImage as saveProductImage,
} from '../controllers/productController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  uploadProductImage,
  validateUploadedImage,
} from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(protect);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post(
  '/:id/image',
  requireOwnedProduct,
  uploadProductImage,
  validateUploadedImage,
  saveProductImage
);

export default router;
