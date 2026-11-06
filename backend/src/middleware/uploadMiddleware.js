import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = process.env.UPLOAD_DIR || (
  process.env.VERCEL
    ? path.join('/tmp', 'medivault-uploads')
    : path.resolve(__dirname, '../../uploads')
);

// Allowed file types: PDF, JPG, PNG
const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Unsupported file format. Please upload a PDF, PNG, or JPG/JPEG document.'
      ),
      false
    );
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // Leave room for multipart fields under Vercel's 4.5 MB limit
    files: 1,
    fields: 4,
    fieldSize: 8 * 1024,
  },
  fileFilter,
});

export const getUploadDirectory = () => uploadDir;

// Signature checks reject mislabeled files; they are not malware scanning.
export const validateFileContent = (req, res, next) => {
  if (!req.file) return next();
  const { buffer, mimetype } = req.file;
  const valid = buffer?.length && (
    (mimetype === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') ||
    (mimetype === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (['image/jpeg', 'image/jpg'].includes(mimetype) && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
  );
  if (!valid) return res.status(400).json({ success: false, message: 'File contents do not match a supported PDF, PNG, or JPEG document.' });
  return next();
};
