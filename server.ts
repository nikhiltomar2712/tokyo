import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI SDK safely
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Guide AI chatbot will fall back to helpful local prompts.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGeminiClient();

// API Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// API endpoint for Yuki, the Tokyo AI Guide Helper
app.post("/api/guide", async (req, res) => {
  const { messages, categoryFocus } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid messages array provided." });
  }

  // Format messages for Gemini API
  // Take last 6 messages to keep the token size neat and fast
  const recentMessages = messages.slice(-6);
  const formattedContents = recentMessages.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }]
  }));

  const systemInstruction = 
    `You are Yuki, an extremely knowledgeable virtual local tour guide of Modern Tokyo. 
    You are stylish, polite, and deeply passionate about Tokyo's unique juxtaposition of futuristic cyberpunk neon culture (Shinjuku Golden Gai, Shibuya nightlife, retro Akihabara arcades, robotic themed cafes) and timeless historical serenity (Asakusa shrines, quiet tea ceremonies, luxury cocktail lounges in Ginza).
    
    Current focus of user is: ${categoryFocus || "General exploration of Tokyo"}.
    
    Instructions:
    1. Respond in clean, elegant Markdown. Use bold lettering, bullet lists, short readable paragraphs, and cozy, travel-friendly emojis.
    2. Provide highly specific advice, real spots (e.g., specific alleys, actual bars, real stations), and estimated costs or best hours when helpful.
    3. Keep your tone inviting, professional, and slightly futuristic.
    4. If explaining Japanese culture, explain it with respect and include short literal translations if appropriate.
    5. Be succinct but incredibly valuable (target 100-250 words per response). If the prompt is missing or general, suggest 3 highly exciting things to do tonight in Tokyo.`;

  try {
    if (!ai) {
      // Fallback response when API key is missing
      return res.json({
        text: `### 🌸 Konnichiwa! I'm Yuki, your Tokyo Guide helper.
        
(Note: The developer's Gemini API Key is currently not connected, so I am running in local offline demo mode!)

Here are some top curated local recommendations for your Tokyo visit:
1. **Shinjuku Golden Gai**: Dive into over 200 tiny, atmospheric shanty bars squeezed into six narrow alleys. Perfect for authentic jazz, friendly locals, and draft beer.
2. **HEY Arcade in Akihabara**: The global temple of nostalgic, multi-tier retro arcade culture. Enjoy rhythm cabinets, retro shoot-em-ups, and claw machines.
3. **The Roof at Shibuya Sky**: Sip stunning craft cocktails 229 meters high, looking down over the pulsing Shibuya Scramble crossing.

*Would you like to ask about custom itineraries, capsule hotels, or local dining etiquette? Let me know!*`
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents.length > 0 ? formattedContents : [{ parts: [{ text: "Hello! Show me 3 exciting Tokyo nightlife ideas." }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const botText = response.text || "I apologize, but my circuits are a bit overloaded. Let's try that again!";
    res.json({ text: botText });

  } catch (error: any) {
    console.error("Gemini API Error in /api/guide:", error);
    res.status(500).json({ 
      error: "Error communicating with Yuki AI guide.", 
      details: error.message || "Unknown error" 
    });
  }
});

// Setup Vite Dev Server / serve static dist files for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`====================================================`);
    console.log(`🚀 Modern Tokyo app running on: http://0.0.0.0:${PORT}`);
    console.log(`====================================================`);
  });
}

startServer();
