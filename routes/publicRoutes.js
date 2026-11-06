import { Router } from 'express';
import {
  getPublicProduct,
  getPublicProducts,
  getPublicStore,
} from '../controllers/publicController.js';

const router = Router();

router.get('/stores/:slug', getPublicStore);
router.get('/stores/:slug/products', getPublicProducts);
router.get('/stores/:slug/products/:id', getPublicProduct);

export default router;
