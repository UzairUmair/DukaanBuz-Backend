import { Router } from 'express';
import {
  updateAppearance,
  createStore,
  getMyStore,
  updateMyStore,
} from '../controllers/storeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/me', getMyStore);
router.post('/', createStore);
router.put('/me/appearance', updateAppearance);
router.put('/me', updateMyStore);

export default router;
