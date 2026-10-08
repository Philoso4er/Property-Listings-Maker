// Vercel serverless function: POST /api/choreograph
import { choreograph, errorStatus } from '../server/gemini.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const result = await choreograph(body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error in /api/choreograph:', err);
    return res.status(errorStatus(err)).json({
      error: err?.message || 'An error occurred during scene choreography.',
    });
  }
}
