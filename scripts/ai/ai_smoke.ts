/** Quick check that both Gemini models respond. Run: npx tsx scripts/ai/ai_smoke.ts */
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "../env";
loadEnv();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
(async () => {
  for (const model of [process.env.AI_MODEL!, process.env.AI_MODEL_FAST!]) {
    const t = Date.now();
    try {
      const r = await ai.models.generateContent({
        model,
        contents: "Reply with JSON {\"ok\":true,\"khmer\":\"<the Khmer word for health>\"}",
        config: { responseMimeType: "application/json" },
      });
      console.log(model, Date.now() - t, "ms →", r.text?.slice(0, 80));
    } catch (e) {
      console.log(model, "ERROR", (e as Error).message.slice(0, 200));
    }
  }
})();
