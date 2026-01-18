const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const run = async () => {
    const key = process.env.GEMINI_API_KEY;
    console.log('Key:', key ? 'Present' : 'Missing');
    if (!key) return;

    try {
        const genAI = new GoogleGenerativeAI(key);
        // Use gemini-1.0-pro which is the current standard model
        const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
        const result = await model.generateContent('Hello');
        console.log('Response:', result.response.text());
    } catch (e) {
        console.error('Error:', e.message);
    }
};
run();
