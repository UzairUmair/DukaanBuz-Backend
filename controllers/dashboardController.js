import Product from '../models/Product.js';
import Store from '../models/Store.js';

export const getDashboardStats = async (req, res) => {
  const store = await Store.findOne({ owner: req.user._id }).select('_id');

  if (!store) {
    return res.json({
      success: true,
      message: 'Dashboard statistics retrieved',
      data: { totalProducts: 0, activeProducts: 0, outOfStockProducts: 0 },
    });
  }

  const [stats] = await Product.aggregate([
    { $match: { store: store._id } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
        outOfStockProducts: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
      },
    },
  ]);

  res.json({
    success: true,
    message: 'Dashboard statistics retrieved',
    data: stats
      ? {
          totalProducts: stats.totalProducts,
          activeProducts: stats.activeProducts,
          outOfStockProducts: stats.outOfStockProducts,
        }
      : { totalProducts: 0, activeProducts: 0, outOfStockProducts: 0 },
  });
};
