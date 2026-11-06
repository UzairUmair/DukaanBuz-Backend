import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const validateRegistration = ({ fullName, email, password }) => {
  const errors = [];
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const normalizedEmail = cleanEmail(email);

  if (name.length < 2 || name.length > 80) {
    errors.push({ field: 'fullName', message: 'Full name must be 2 to 80 characters' });
  }
  if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
    errors.push({ field: 'email', message: 'A valid email address is required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  } else if (Buffer.byteLength(password, 'utf8') > 72) {
    errors.push({ field: 'password', message: 'Password must not exceed 72 bytes' });
  }

  return { errors, name, normalizedEmail };
};

const createToken = (userId) =>
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId.toString(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });

export const register = async (req, res) => {
  const { errors, name, normalizedEmail } = validateRegistration(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  const existingUser = await User.exists({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists',
      errors: [{ field: 'email', message: 'Email is already registered' }],
    });
  }

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({
    fullName: name,
    email: normalizedEmail,
    passwordHash,
  });

  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { user: user.toJSON() },
  });
};

export const login = async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = req.body.password;

  if (!email || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      errors: [],
    });
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      errors: [],
    });
  }

  const token = createToken(user._id);
  user.passwordHash = undefined;

  return res.json({
    success: true,
    message: 'Login successful',
    data: { token, user: user.toJSON() },
  });
};

export const getMe = async (req, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved',
    data: { user: req.user.toJSON() },
  });
};
