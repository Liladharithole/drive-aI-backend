import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function testGeneration() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const models = [
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-2.0-flash-lite',
    'gemini-3.5-flash',
  ];

  for (const m of models) {
    try {
      console.log(`Testing generation with model: "${m}"...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: 'Hello, respond with OK',
      });
      console.log(`SUCCESS [${m}]:`, response.text.trim());
    } catch (err) {
      console.error(`FAILED [${m}]:`, err.message);
    }
  }
}

testGeneration();
