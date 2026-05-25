require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    try {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        console.log("Using API Key starting with: ", apiKey.substring(0, 5) + "...");
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Use standard fetch directly to the REST API to list models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(m.name, "-", m.supportedGenerationMethods.join(", ")));
        } else {
            console.error("Error fetching models:", data);
        }
    } catch (e) {
        console.error(e);
    }
}
listModels();
