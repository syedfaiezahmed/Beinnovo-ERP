const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const run = async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.log('No API Key found');
        return;
    }
    
    try {
        const genAI = new GoogleGenerativeAI(key);
        // Note: listModels is on the genAI instance or via model manager depending on SDK version
        // In newer SDKs:
        /*
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Testing model direct call...");
        await model.generateContent("test");
        */
       
       // There isn't a direct "listModels" helper exposed easily in the main class in some versions, 
       // but we can try a basic generation to a known stable model.
       
       const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'models/gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-pro-latest'];
       
       for (const modelName of modelsToTry) {
           console.log(`Testing ${modelName}...`);
           try {
               const model = genAI.getGenerativeModel({ model: modelName });
               const result = await model.generateContent('Hi');
               console.log(`✅ ${modelName} WORKED! Response: ${result.response.text()}`);
               return; // Stop on first success
           } catch (e) {
               console.log(`❌ ${modelName} Failed: ${e.message.split('\n')[0]}`);
           }
       }
       
    } catch (e) {
        console.error('Fatal Error:', e);
    }
};
run();