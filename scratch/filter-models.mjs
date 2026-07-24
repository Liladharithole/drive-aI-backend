import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  try {
    const pager = await ai.models.list();
    // @google/genai pager has an async iterator or page items
    for await (const m of pager) {
      console.log('Model Name:', m.name);
    }
  } catch (err) {
    console.error('List models failed:', err.message);
  }
}

listModels();
