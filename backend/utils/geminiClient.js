import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

const MAX_GEMINI_RETRIES = 5;

const GEMINI_KEY_ENV_VARS = [
    'GEMINI_API_KEY',
    'GEMINI_API_KEY_2',
    'GEMINI_API_KEY_3',
    'GEMINI_API_KEY_4',
    'GEMINI_API_KEY_5',
];

function getGeminiApiKeys() {
    return GEMINI_KEY_ENV_VARS
        .map((name) => process.env[name])
        .filter(Boolean);
}

function getErrorStatus(error) {
    return error?.status
        ?? error?.statusCode
        ?? error?.response?.status
        ?? error?.cause?.status;
}

function isRetryableGeminiError(error) {
    const status = getErrorStatus(error);
    if (status === 429 || status === 503) {
        return true;
    }

    const errorText = String(error?.message || error).toLowerCase();
    return (
        errorText.includes('rate limit')
        || errorText.includes('ratelimit')
        || errorText.includes('quota')
        || errorText.includes('resource_exhausted')
        || errorText.includes('resource exhausted')
    );
}

async function withGeminiKeyRotation(operation) {
    const keys = getGeminiApiKeys();
    if (!keys.length) {
        throw new Error(
            'No Gemini API keys configured. Set GEMINI_API_KEY and optional GEMINI_API_KEY_2 through GEMINI_API_KEY_5.'
        );
    }

    let lastError;
    for (let attempt = 0; attempt < MAX_GEMINI_RETRIES; attempt++) {
        const apiKey = keys[attempt % keys.length];
        try {
            return await operation(apiKey);
        } catch (error) {
            lastError = error;
            if (!isRetryableGeminiError(error) || attempt === MAX_GEMINI_RETRIES - 1) {
                throw error;
            }
            console.warn(`[Gemini] attempt ${attempt + 1}/${MAX_GEMINI_RETRIES} failed, rotating key...`);
        }
    }

    throw lastError;
}

async function invokeGeminiChat(prompt, options = {}, invokeOptions) {
    return withGeminiKeyRotation(async (apiKey) => {
        const model = new ChatGoogleGenerativeAI({
            ...options,
            apiKey,
        });
        return model.invoke(prompt, invokeOptions);
    });
}

function createGeminiChatModel(options = {}) {
    const modelOptions = {
        model: process.env.GEMINI_MODEL_NAME || 'gemini-3.1-flash-lite-preview',
        temperature: 0.28,
        maxOutputTokens: 1000,
        ...options,
    };

    return {
        invoke: (prompt, invokeOptions) => invokeGeminiChat(prompt, modelOptions, invokeOptions),
    };
}

function createGeminiEmbeddings(options = {}) {
    const embeddingOptions = {
        model: process.env.EMBEDDING_MODEL_NAME || 'text-embedding-004',
        ...options,
    };

    return {
        embedQuery: (text) => withGeminiKeyRotation(async (apiKey) => {
            const embeddings = new GoogleGenerativeAIEmbeddings({
                ...embeddingOptions,
                apiKey,
            });
            return embeddings.embedQuery(text);
        }),
        embedDocuments: (documents) => withGeminiKeyRotation(async (apiKey) => {
            const embeddings = new GoogleGenerativeAIEmbeddings({
                ...embeddingOptions,
                apiKey,
            });
            return embeddings.embedDocuments(documents);
        }),
    };
}

export {
    MAX_GEMINI_RETRIES,
    createGeminiChatModel,
    createGeminiEmbeddings,
    getGeminiApiKeys,
    invokeGeminiChat,
    isRetryableGeminiError,
    withGeminiKeyRotation,
};
