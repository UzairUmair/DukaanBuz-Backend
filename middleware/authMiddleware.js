import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required',
        errors: [],
      });
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required',
        errors: [],
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user for this token no longer exists',
        errors: [],
      });
    }

    req.user = user;
    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Authentication token has expired'
        : 'Authentication token is invalid';

    return res.status(401).json({ success: false, message, errors: [] });
  }
};
