import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { choreograph, generateCaption, errorStatus } from './server/gemini.js';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit to support uploaded property image previews
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API Routes (mirrors the Vercel serverless functions in /api)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint to choreograph a cinematic tour using Gemini AI
app.post('/api/choreograph', async (req, res) => {
  try {
    res.json(await choreograph(req.body));
  } catch (err: any) {
    console.error('Error in /api/choreograph:', err);
    res.status(errorStatus(err)).json({
      error: err.message || 'An error occurred during scene choreography.'
    });
  }
});

// Endpoint to analyze an image and generate a caption, title, and motion pan
app.post('/api/generate-caption', async (req, res) => {
  try {
    res.json(await generateCaption(req.body));
  } catch (err: any) {
    console.error('Error in /api/generate-caption:', err);
    res.status(errorStatus(err)).json({
      error: err.message || 'An error occurred during caption generation.'
    });
  }
});

// Configure Vite middleware in development, or serve built assets in production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static serving active.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cinematic tour dev server listening on port ${PORT}`);
  });
}

setupServer();
