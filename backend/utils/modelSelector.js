import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { createGeminiChatModel, createGeminiEmbeddings } from './geminiClient.js';

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
                model: createGeminiChatModel(),
                embeddings: createGeminiEmbeddings(),
            };
    }
}

export {
    getModelConfig,
};
