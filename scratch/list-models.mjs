import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  try {
    const res = await ai.models.list();
    console.log('Available models response:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('List models failed:', err.message);
  }
}

listModels();
