import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getUploadDirectory } from '../middleware/uploadMiddleware.js';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'medicalFiles' });
const missingFile = () => Object.assign(new Error('Document file is missing. Please upload it again.'), { statusCode: 404 });

export const saveFile = async (buffer, filename) => {
  const store = bucket();
  const upload = store.openUploadStream(filename);
  try {
    await pipeline(Readable.from([buffer]), upload);
    return upload.id;
  } catch (error) {
    await store.delete(upload.id).catch(() => {});
    throw error;
  }
};

// Controllers must authorize the record before calling storage helpers.
export const readFile = async (record) => {
  if (record.storageFileId) {
    const store = bucket();
    if (!await store.find({ _id: record.storageFileId }).hasNext()) throw missingFile();
    const chunks = [];
    for await (const chunk of store.openDownloadStream(record.storageFileId)) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  // Keep existing local/demo records readable; new uploads always use GridFS.
  try {
    return await fs.readFile(path.join(getUploadDirectory(), path.basename(record.storedFileName)));
  } catch (error) {
    if (error.code === 'ENOENT') throw missingFile();
    throw error;
  }
};

export const deleteFile = async (record) => {
  if (record.storageFileId) {
    const store = bucket();
    if (await store.find({ _id: record.storageFileId }).hasNext()) await store.delete(record.storageFileId);
  } else {
    await fs.unlink(path.join(getUploadDirectory(), path.basename(record.storedFileName))).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
};

export const sendFile = (res, record, buffer) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.attachment(record.fileName);
  res.type(record.fileType);
  return res.send(buffer);
};
