import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/stats', protect, getDashboardStats);

export default router;
