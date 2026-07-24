import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing key:', apiKey ? `${apiKey.slice(0, 8)}...` : 'MISSING');
  const ai = new GoogleGenAI({ apiKey });

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
  for (const m of models) {
    try {
      console.log(`Testing model "${m}"...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Hello, respond with OK',
      });
      console.log(`SUCCESS [${m}]:`, res.text);
      break;
    } catch (err) {
      console.error(`FAILED [${m}]:`, err.message);
    }
  }
}

test();
