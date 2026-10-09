import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import medicalStaffRoutes from './routes/medicalStaffRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import clinicalAccessRoutes from './routes/clinicalAccessRoutes.js';

// Initialize database
connectDB();

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
      const allowedOrigins = (process.env.CLIENT_URL || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
    : true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'MediVault Core RBAC API',
    version: '2.0.0-RBAC',
    rolesSupported: ['patient', 'medical_staff', 'insurance_agent', 'admin', 'caregiver_proxy'],
    timestamp: new Date().toISOString(),
  });
});

// Mount Core & Role-Based Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/medical-staff', medicalStaffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clinical-access', clinicalAccessRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[MediVault Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

export default app;
