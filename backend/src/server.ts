import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { apiRouter } from './routes/api.routes.js';
import { getDb } from './database/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(cors({
  origin: '*', // Allow Vite frontend and Chrome extension
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    product: 'JobPilot AI',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

// Main API Router
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'An internal server error occurred'
  });
});

// Initialize DB and Start
getDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`JobPilot AI backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database on startup:', err);
    process.exit(1);
  });
