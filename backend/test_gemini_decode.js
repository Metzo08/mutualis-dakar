const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found!");
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `Vous êtes Zahara, l'assistante virtuelle de MUTUALIS DAKAR.
Règles de décodage :
- L'utilisateur utilise la reconnaissance vocale de son navigateur qui ne supporte pas le Wolof natively.
- Le texte transcrit est donc souvent du charabia phonétique en anglais ou en français qui imite les sous-jacents phonétiques du Wolof (ex: "am I booking go" pour "ndax am nga", "bubble tea" pour "bëgg", "Brand answer" pour "tontu", etc.).
- Vous devez détecter ce charabia, reconstruire mentalement la question en Wolof, puis y répondre de manière concise et professionnelle uniquement en WOLOF.`
    });

    const userMsg = "am I booking go with my got to be bubble tea yeah me you see me Brand answer";
    console.log("INPUT TRANSCRIPTION:", userMsg);
    
    const result = await model.generateContent(userMsg);
    console.log('\n--- RESPONSE IN WOLOF ---');
    console.log(result.response.text().trim());
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
