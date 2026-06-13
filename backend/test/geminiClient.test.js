import { test } from 'tap';

const KEY_ENV_VARS = [
    'GEMINI_API_KEY',
    'GEMINI_API_KEY_2',
    'GEMINI_API_KEY_3',
    'GEMINI_API_KEY_4',
    'GEMINI_API_KEY_5',
];

function saveGeminiEnv() {
    return Object.fromEntries(KEY_ENV_VARS.map((name) => [name, process.env[name]]));
}

function restoreGeminiEnv(saved) {
    for (const name of KEY_ENV_VARS) {
        if (saved[name] === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = saved[name];
        }
    }
}

function setGeminiKeys(keys) {
    for (const name of KEY_ENV_VARS) {
        delete process.env[name];
    }
    keys.forEach((value, index) => {
        process.env[KEY_ENV_VARS[index]] = value;
    });
}

test('getGeminiApiKeys collects numbered vars and skips empty', async (t) => {
    const saved = saveGeminiEnv();
    setGeminiKeys(['key-one', '', 'key-three']);

    const { getGeminiApiKeys } = await import('../utils/geminiClient.js');
    t.same(getGeminiApiKeys(), ['key-one', 'key-three']);

    restoreGeminiEnv(saved);
    t.end();
});

test('isRetryableGeminiError detects quota and rate-limit failures', async (t) => {
    const { isRetryableGeminiError } = await import('../utils/geminiClient.js');

    t.ok(isRetryableGeminiError(Object.assign(new Error('Rate limit exceeded'), { status: 429 })));
    t.ok(isRetryableGeminiError(new Error('Quota exceeded for this project')));
    t.ok(isRetryableGeminiError(new Error('RESOURCE_EXHAUSTED: too many requests')));
    t.ok(isRetryableGeminiError(Object.assign(new Error('Service unavailable'), { status: 503 })));
    t.notOk(isRetryableGeminiError(new Error('Invalid API key')));
    t.notOk(isRetryableGeminiError(Object.assign(new Error('Unauthorized'), { status: 401 })));
    t.end();
});

test('invokeGeminiChat retries with next key on rate limit then succeeds', async (t) => {
    const saved = saveGeminiEnv();
    setGeminiKeys(['key-one', 'key-two', 'key-three']);

    let attempt = 0;
    const usedKeys = [];

    const { invokeGeminiChat } = await t.mockImport('../utils/geminiClient.js', {
        '@langchain/google-genai': {
            ChatGoogleGenerativeAI: class {
                constructor({ apiKey }) {
                    this.apiKey = apiKey;
                }

                async invoke() {
                    usedKeys.push(this.apiKey);
                    attempt += 1;
                    if (attempt <= 2) {
                        throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
                    }
                    return { content: 'ok', usage_metadata: { total_tokens: 10 } };
                }
            },
            GoogleGenerativeAIEmbeddings: class {},
        },
    });

    const response = await invokeGeminiChat('hello', { model: 'gemini-test' });

    t.equal(response.content, 'ok');
    t.equal(attempt, 3);
    t.same(usedKeys, ['key-one', 'key-two', 'key-three']);

    restoreGeminiEnv(saved);
    t.end();
});

test('invokeGeminiChat does not retry non-retryable errors', async (t) => {
    const saved = saveGeminiEnv();
    setGeminiKeys(['key-one', 'key-two']);

    let attempt = 0;

    const { invokeGeminiChat } = await t.mockImport('../utils/geminiClient.js', {
        '@langchain/google-genai': {
            ChatGoogleGenerativeAI: class {
                constructor({ apiKey }) {
                    this.apiKey = apiKey;
                }

                async invoke() {
                    attempt += 1;
                    throw Object.assign(new Error('Invalid API key'), { status: 401 });
                }
            },
            GoogleGenerativeAIEmbeddings: class {},
        },
    });

    await t.rejects(
        invokeGeminiChat('hello', { model: 'gemini-test' }),
        /Invalid API key/
    );
    t.equal(attempt, 1);

    restoreGeminiEnv(saved);
    t.end();
});

test('withGeminiKeyRotation throws when no keys are configured', async (t) => {
    const saved = saveGeminiEnv();
    setGeminiKeys([]);

    const { withGeminiKeyRotation } = await import('../utils/geminiClient.js');

    await t.rejects(
        withGeminiKeyRotation(async () => 'unused'),
        /No Gemini API keys configured/
    );

    restoreGeminiEnv(saved);
    t.end();
});
