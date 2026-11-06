import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const productUploadDirectory = path.resolve(currentDirectory, '../uploads/products');

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPEG, PNG and WebP images are allowed');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

export const uploadProductImage = upload.single('image');

const detectImageType = (bytes) => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return null;
};

export const validateUploadedImage = (req, _res, next) => {
  if (!req.file) {
    const error = new Error('Image file is required in the image field');
    error.statusCode = 400;
    return next(error);
  }

  const detected = detectImageType(req.file.buffer);
  if (!detected || detected.mimeType !== req.file.mimetype) {
    const error = new Error('Uploaded file content is not a valid JPEG, PNG or WebP image');
    error.statusCode = 400;
    return next(error);
  }

  req.file.extension = detected.extension;
  req.file.mimeType = detected.mimeType;
  next();
};
