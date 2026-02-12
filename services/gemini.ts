
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper to extract JSON from potentially markdown-wrapped string
 */
const extractJson = (text: string) => {
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse AI JSON response:", text);
    throw e;
  }
};

const getGeminiApiKey = () => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Set API_KEY or GEMINI_API_KEY.');
  }
  return apiKey;
};

// Fix: Creating GoogleGenAI instance inside each function call ensures it always uses the current API key.
export const generateProfessionalReceipt = async (clientName: string, items: any[], totalPrice: number) => {
  try {
    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    
    // Get current date in English format
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional fashion atelier assistant. 
      Task: Create a professional invoice/receipt in ENGLISH based on the provided data.
      
      STRICT RULES:
      1. Output ONLY a valid JSON object.
      2. The output MUST be in English.
      3. In the "service" field, translate the item name to professional English. Keep it direct and accurate to the original input (e.g., "Dress", "Trousers", "Skirt"). Do not over-embellish or use fancy abstract terms.
      4. In the "description" field, translate the specific work details to concise, professional English. Keep it strictly based on the original input text, just polished (e.g., "Shorten hem", "Waist reduction").
      5. The "footerMessage" should be a classy thank you note.
      6. Use the provided date EXACTLY.

      Data:
      Current Date: ${today}
      Client Name (Hebrew source): ${clientName}
      Items: ${JSON.stringify(items)}
      Total: $${totalPrice}`,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            receiptNumber: { type: Type.STRING },
            date: { type: Type.STRING },
            billTo: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  service: { type: Type.STRING },
                  description: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            },
            subtotal: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            footerMessage: { type: Type.STRING }
          },
          required: ["billTo", "items", "subtotal", "total"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    return extractJson(text);
  } catch (error) {
    console.error("AI Receipt Generation Failed:", error);
    return null;
  }
};
