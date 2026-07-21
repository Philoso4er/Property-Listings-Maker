import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit to support uploaded property image previews
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Lazy initializer for Gemini Client to avoid crashing if API key is not yet set
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not defined in the Secrets panel.');
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Endpoint to choreograph a cinematic tour using Gemini AI
app.post('/api/choreograph', async (req, res) => {
  try {
    const { roomName, category, description, customPrompt, base64Image } = req.body;
    const ai = getGeminiClient();

    let systemInstruction = `You are an elite architectural photographer, real estate cinematic director, and high-end virtual home stager.
Your job is to analyze a property space description or image, identify its prime structural highlights (windows, fireplaces, countertops, beds, fixtures), and choreograph a flawless 4-step cinematic camera tour.
You must also suggest optimal virtual staging atmospheric filters and placement ideas.

For each of the 4 keyframes, define:
- scale: zoom level (1.0 for full view, up to 2.2 for extreme focus details)
- targetX: focal point center horizontal coordinate in percentage (0 to 100, where 50 is center)
- targetY: focal point center vertical coordinate in percentage (0 to 100, where 50 is center)
- duration: transition duration in seconds (usually between 4 and 6 seconds)
- caption: a beautifully written, warm, premium real estate narration subtitle explaining the highlights visible at this specific zoom coordinate (e.g., 'Large floor-to-ceiling windows frame gorgeous sunset views...'). Must sound sophisticated, inviting, and professional.
- easing: the movement flow ('linear' | 'easeInOut' | 'easeIn' | 'easeOut')

Also recommend the overall:
- filterName: best lighting filter match ('golden' | 'dusk' | 'warm_noon' | 'moody' | 'sunny_morning')
- suggestedEffects: fireplace intensity (if fireplace exists, 0 to 1), sunlight intensity (0 to 1), floating dust motes intensity (0 to 1), shadow tree sways (0 to 1)
- interiorStyle: aesthetic classification (e.g., 'Modern Scandinavian Luxury', 'Industrial Craftsman', 'Bohemian Solarium')
- stagingIdeas: list of 3-4 specific high-value furniture or accent pieces to virtually stage into the space.`;

    let contents: any[] = [];
    let promptText = `Choreograph a premium camera tour and virtual staging layout for this space:
Name: ${roomName || 'Custom Property Space'}
Category: ${category || 'Interior Space'}
Description/Vibe: ${description || 'A beautiful, modern residential interior.'}
Special Directives: ${customPrompt || 'Create a smooth, cinematic, slow-panning tour showcasing the scale and organic light of the room.'}

Ensure the camera pan is fluid and focuses on logical focal points in a sequence (e.g., start with an establishing shot at 1.0 zoom, then pan/zoom to a main feature like a window or hearth, then pan to another detailed texture, and end on a balanced wide shot).`;

    if (base64Image) {
      // If user uploaded a custom image, send the image part along to Gemini for visual analysis!
      // Base64 format: data:image/png;base64,iVBORw0KGgoAAA...
      const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const data = match[2];
        contents.push({
          inlineData: {
            mimeType,
            data
          }
        });
        promptText += `\n[Analyze the provided image visually to identify key structural focal points like fireplace position, window coordinates, furniture, or kitchen islands, and align the coordinates (targetX, targetY) specifically to these locations in the image!]`;
      }
    }

    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['keyframes', 'filterName', 'suggestedEffects', 'interiorStyle', 'stagingIdeas'],
          properties: {
            interiorStyle: {
              type: Type.STRING,
              description: 'The aesthetic architectural style of this room.'
            },
            filterName: {
              type: Type.STRING,
              description: 'The best matching ambient lighting filter: golden, dusk, warm_noon, moody, or sunny_morning'
            },
            suggestedEffects: {
              type: Type.OBJECT,
              required: ['fireplaceIntensity', 'sunlightIntensity', 'dustIntensity', 'shadowSwayIntensity'],
              properties: {
                fireplaceIntensity: { type: Type.NUMBER, description: 'Warm hearth/fireplace flicker strength from 0.0 (none) to 1.0 (strong).' },
                sunlightIntensity: { type: Type.NUMBER, description: 'Sunbeam drifting brightness from 0.0 to 1.0.' },
                dustIntensity: { type: Type.NUMBER, description: 'Floating dust particle density in light rays from 0.0 to 1.0.' },
                shadowSwayIntensity: { type: Type.NUMBER, description: 'Swaying tree shadows on floor/walls from 0.0 to 1.0.' }
              }
            },
            keyframes: {
              type: Type.ARRAY,
              description: 'The choreographed series of 4 cinematic keyframes.',
              items: {
                type: Type.OBJECT,
                required: ['scale', 'targetX', 'targetY', 'duration', 'caption', 'easing'],
                properties: {
                  scale: { type: Type.NUMBER, description: 'Zoom level, float between 1.0 (wide) and 2.2 (detail focus).' },
                  targetX: { type: Type.NUMBER, description: 'Horizontal center focal percent coordinate (0 to 100).' },
                  targetY: { type: Type.NUMBER, description: 'Vertical center focal percent coordinate (0 to 100).' },
                  duration: { type: Type.NUMBER, description: 'Keyframe travel time in seconds, typically 4 to 6.' },
                  caption: { type: Type.STRING, description: 'Poetic, luxurious real estate subtitle narration describing this highlight.' },
                  easing: { type: Type.STRING, description: 'Ease setting: linear, easeInOut, easeIn, easeOut' }
                }
              }
            },
            stagingIdeas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-4 custom placement suggestions for virtual staging decorations.'
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('AI returned an empty response.');
    }

    const result = JSON.parse(text.trim());
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/choreograph:', err);
    res.status(500).json({
      error: err.message || 'An error occurred during scene choreography.'
    });
  }
});

// Endpoint to automatically analyze an image (local upload as base64 or external URL) using Gemini API
// and output an appropriate, luxurious real estate caption, title, and optimal motion pan.
app.post('/api/generate-caption', async (req, res) => {
  try {
    const { base64Image, imageUrl, userGuidance } = req.body;
    const ai = getGeminiClient();

    let mimeType = 'image/jpeg';
    let data = '';

    if (base64Image) {
      const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        data = match[2];
      } else {
        data = base64Image;
      }
    } else if (imageUrl) {
      try {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) {
          throw new Error(`Failed to fetch image from URL: ${fetchRes.statusText}`);
        }
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        data = buffer.toString('base64');
        mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
      } catch (fetchErr: any) {
        console.error('Error fetching imageUrl for caption:', fetchErr);
        return res.status(400).json({ error: `Could not fetch or read external image URL: ${fetchErr.message}` });
      }
    } else {
      return res.status(400).json({ error: 'Please provide either a base64Image or an imageUrl to analyze.' });
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data,
      },
    };

    let promptText = `Analyze this property photograph visually. Based on the interior or exterior shown, generate:
1. An elegant, appealing room or view name (e.g., 'Verdant Sunroom Oasis', 'Minimalist Slate Bath'). Keep it under 5 words.
2. A suggested optimal camera pan type matching the visual composition. Choose from EXACTLY one of these strings:
   - 'pan_left_to_right' (good for wide rooms, broad views)
   - 'pan_right_to_left' (good for wide rooms, broad views)
   - 'zoom_in' (good for deep visual corridors, focusing on cozy beds, central features)
   - 'zoom_out' (good for revealing scale from a close element)
   - 'pan_up' (good for high double-height ceilings, fireplaces, large light fixtures)
   - 'pan_down' (good for highlighting rich floor patterns)
   - 'diagonal_drift' (for dynamic artistic vibe)
   - 'steady_hold' (for extremely detailed close-ups)
3. A beautifully styled, luxurious real estate narration subtitle (caption) describing the highlights, light quality, materials, or atmosphere visible in this shot. It must sound highly professional, warm, and sophisticated. Keep it under 25 words.`;

    if (userGuidance && typeof userGuidance === 'string' && userGuidance.trim().length > 0) {
      promptText += `\n\nCRITICAL USER GUIDELINE/CONTEXT:\nThe user has provided custom instructions or background text to shape the response. You MUST align the tone, style, specific details, or descriptive adjectives with this instruction:\n"""\n${userGuidance}\n"""`;
    }

    const contents = [imagePart, { text: promptText }];

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: 'You are an elite real estate copywriter and professional cinematic director specializing in architectural narratives.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['name', 'panType', 'caption'],
          properties: {
            name: {
              type: Type.STRING,
              description: 'An elegant, appealing room or view name.'
            },
            panType: {
              type: Type.STRING,
              description: 'The suggested motion: pan_left_to_right, pan_right_to_left, zoom_in, zoom_out, pan_up, pan_down, diagonal_drift, or steady_hold.'
            },
            caption: {
              type: Type.STRING,
              description: 'A beautiful, warm, and sophisticated real estate narration subtitle, max 150 characters.'
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    const result = JSON.parse(text.trim());
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/generate-caption:', err);
    res.status(500).json({
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
