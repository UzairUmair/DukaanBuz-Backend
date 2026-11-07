import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { productUploadDirectory } from '../middleware/uploadMiddleware.js';

const prefix = '/uploads/products/';
const gridFsFilename = /^[a-f\d]{24}\.(jpg|png|webp)$/;
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'productImages' });

export const saveImage = async (file) => {
  if (process.env.VERCEL !== '1') {
    const filename = `${Date.now()}-${crypto.randomUUID()}.${file.extension}`;
    await fs.mkdir(productUploadDirectory, { recursive: true });
    await fs.writeFile(path.join(productUploadDirectory, filename), file.buffer, { flag: 'wx' });
    return `${prefix}${filename}`;
  }

  const id = new mongoose.Types.ObjectId();
  const filename = `${id}.${file.extension}`;
  const stream = bucket().openUploadStreamWithId(id, filename, {
    metadata: { mimeType: file.mimeType },
  });
  await new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.once('finish', resolve);
    stream.end(file.buffer);
  });
  return `${prefix}${filename}`;
};

export const removeImage = async (imageUrl) => {
  if (!imageUrl?.startsWith(prefix)) return;
  const filename = imageUrl.slice(prefix.length);
  if (path.basename(filename) !== filename) return;

  try {
    if (process.env.VERCEL === '1' && gridFsFilename.test(filename)) {
      await bucket().delete(new mongoose.Types.ObjectId(filename.slice(0, 24)));
    } else if (process.env.VERCEL !== '1') {
      await fs.unlink(path.join(productUploadDirectory, filename));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Unable to remove product image:', error.message);
  }
};

export const getGridImage = async (req, res, next) => {
  const { filename } = req.params;
  if (!gridFsFilename.test(filename)) return next();

  const id = new mongoose.Types.ObjectId(filename.slice(0, 24));
  const [file] = await bucket().find({ _id: id, filename }).toArray();
  if (!file) return next();

  const mimeType = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[filename.split('.').pop()];
  res.set({ 'Content-Type': mimeType, 'Content-Length': file.length, 'X-Content-Type-Options': 'nosniff' });
  const stream = bucket().openDownloadStream(id);
  try {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    res.send(Buffer.concat(chunks));
  } catch (error) { next(error); }
};
