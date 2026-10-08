// Vercel serverless function: GET /api/health
export default function handler(_req: any, res: any) {
  return res.status(200).json({
    status: 'healthy',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
