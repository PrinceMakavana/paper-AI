import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';

function getModelConfig(chatModel = 'gemini') {
    switch (chatModel) {
        case 'ollama':
            return {
                model: new ChatOllama({
                    baseUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
                    model: process.env.OLLAMA_MODEL_NAME || 'llama3',
                }),
                embeddings: new OllamaEmbeddings({
                    baseUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
                    model: process.env.OLLAMA_EMBEDDING_MODEL_NAME || 'nomic-embed-text',
                }),
            };

        case 'gemini':
        default:
            return {
                model: new ChatGoogleGenerativeAI({
                    model: process.env.GEMINI_MODEL_NAME || 'gemini-3.1-flash-lite-preview',
                    apiKey: process.env.GEMINI_API_KEY,
                    temperature: 0.28,
                    maxOutputTokens: 1000,
                }),
                embeddings: new GoogleGenerativeAIEmbeddings({
                    apiKey: process.env.GEMINI_API_KEY,
                    model: process.env.EMBEDDING_MODEL_NAME || 'text-embedding-004',
                }),
            };
    }
}

export {
    getModelConfig,
};
