import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("ENV KEY:", import.meta.env.VITE_GEMINI_API_KEY);

/**
 * MEDAI - GEMINI INTEGRATION (OPTIMIZED)
 * --------------------------------------
 * Using Gemini 2.0 Flash for best speed + request capacity
 */

// 🔐 API KEY
const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY ?? "").trim();

// 🧪 DEBUG MODE
const DEBUG = false;

const debugLog = (...args: any[]) => {
  if (DEBUG) console.log("[MedAI]:", ...args);
};

// Check API availability
const isApiReady = (): boolean => {
  const ready = !!API_KEY && API_KEY.trim().length > 0;

  if (!ready) debugLog("❌ API Key missing");
  else debugLog("✅ API Key loaded");

  return ready;
};

// -------------------- GEMINI INIT --------------------

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const getModel = () => {
  if (!genAI) return null;

  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "You are MedAI, a professional and empathetic AI Medical Assistant. " +
      "Provide structured health guidance (hydration, rest, nutrition, risk level). " +
      "Always include disclaimer: you are not a doctor. " +
      "If emergency symptoms appear (chest pain, breathing issues), advise immediate medical help.",
  });
};

// -------------------- RISK ANALYSIS --------------------

export const analyzeRisk = (
  symptoms: string[],
  text: string
): "low" | "medium" | "high" => {
  const highRiskKeywords = [
    "chest pain",
    "difficulty breathing",
    "stroke",
    "unconscious",
    "severe bleeding",
    "heart attack",
    "suicidal",
  ];

  const input = (symptoms.join(" ") + " " + text).toLowerCase();

  if (highRiskKeywords.some((k) => input.includes(k))) return "high";
  if (symptoms.length > 3) return "medium";
  return "low";
};

// -------------------- FALLBACK MODE --------------------

const getFallbackResponse = (
  input: string,
  symptoms: string[],
  hasImage: boolean
): string => {
  const query = input.toLowerCase();

  debugLog("⚠️ Offline fallback mode");

  if (query.includes("water") || query.includes("hydrate")) {
    return `Hydration is important. Aim for ~2–3 liters daily. ${
      symptoms[0] || "symptoms"
    } may benefit from electrolytes.${
      hasImage ? " Image noted." : ""
    }`;
  }

  if (query.includes("sleep") || query.includes("rest")) {
    return "Aim for 7–9 hours of sleep daily for proper recovery.";
  }

  return "AI is currently offline. Please check API configuration.";
};

// -------------------- MAIN FUNCTION --------------------

export const getAIResponse = async (
  input: string,
  symptoms: string[],
  image?: string
): Promise<string> => {
  debugLog("Input:", input);

  // ❌ API not ready → fallback
  if (!isApiReady()) {
    return getFallbackResponse(input, symptoms, !!image);
  }

  try {
    const model = getModel();
    if (!model) throw new Error("Model initialization failed");

  const prompt = `
You are a highly intelligent, concise AI assistant chatbot.

You answer ALL types of user questions:
- Medical symptoms
- Pet behavior
- General knowledge
- Explanations
- Advice
- Everyday queries

USER INPUT:
Symptoms: ${symptoms.length ? symptoms.join(", ") : "None"}
Query: ${input}
${image ? "Image provided for analysis." : ""}

CORE RULES:
- Keep responses VERY SHORT (max 6–10 lines total)
- No markdown symbols (*, #, -, bullets)
- Use clean chat-style formatting only
- Be accurate, logical, and reason-based
- If uncertain, say “possible reasons” instead of guessing
- Always prioritize safety and correctness

RESPONSE STYLE (STRICT FORMAT):

Answer:
Give a direct, simple answer in 1–2 lines.

Reason:
Explain WHY in 2–3 short lines (logic or medical/behavioral/scientific reasoning).

Advice:
Give practical next step in 1–3 lines.

Alert (only if needed):
Only include if there is risk, warning signs, or urgency.

MEDICAL RULES:
- Do NOT prescribe prescription-only medicines
- Only suggest safe general OTC options if clearly low-risk
- Always include doctor advice if symptoms could be serious

PET QUESTIONS RULES:
- Explain behavior scientifically (stress, sleep cycle, diet, environment, age, illness)
- Do NOT assume disease unless strong signs exist

GENERAL RULES:
- Always adapt reasoning to ANY topic (science, psychology, pets, tech, daily life)
- Never refuse unless unsafe or harmful
- Be neutral, factual, and calm

OUTPUT GOAL:
A chatbot-style response that feels like:
short
smart
human
easy to read
no clutter
`;
    debugLog("🚀 Sending request to Gemini 2.0 Flash...");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    debugLog("✅ Response received");

    return text;
  } catch (error) {
    console.error("❌ Gemini API Error:", error);

    return (
      "AI service error. Switching to offline mode.\n\n" +
      getFallbackResponse(input, symptoms, !!image)
    );
  }
};