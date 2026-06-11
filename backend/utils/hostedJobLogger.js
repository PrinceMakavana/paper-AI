import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

const LOG_PREFIX = '[PageIndexHostedJob]';
const HOSTED_JOB_LOG_DIR = path.join(__dirname, '..', 'logs', 'hosted-jobs');

function ensureLogDir() {
    fs.mkdirSync(HOSTED_JOB_LOG_DIR, { recursive: true });
}

function sanitizeForLog(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
        if (value.length > 500) {
            return `${value.slice(0, 500)}…[truncated]`;
        }
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return String(value);
    }
}

function formatError(error) {
    if (!error) return null;
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.response?.status,
            responseData: sanitizeForLog(
                typeof error.response?.data === 'string'
                    ? error.response.data
                    : error.response?.data,
            ),
        };
    }
    return { message: String(error) };
}

function buildConsoleLine(level, jobId, step, message) {
    const parts = [LOG_PREFIX, level];
    if (jobId) parts.push(`job=${jobId}`);
    if (step) parts.push(`step=${step}`);
    parts.push(message);
    return parts.join(' | ');
}

function writeToConsole(level, line, meta) {
    const payload = meta && Object.keys(meta).length > 0
        ? `${line} ${JSON.stringify(meta)}`
        : line;

    switch (level) {
        case 'ERROR':
            console.error(payload);
            break;
        case 'WARN':
            console.warn(payload);
            break;
        case 'SUCCESS':
            console.log(payload);
            break;
        default:
            console.log(payload);
    }
}

function createHostedJobLogger({ jobId, userId }) {
    ensureLogDir();

    const startedAt = new Date();
    const filename = `job_${jobId}_${startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    const filepath = path.join(HOSTED_JOB_LOG_DIR, filename);

    const logData = {
        job_id: jobId,
        user_id: userId || 'unknown',
        started_at: startedAt.toISOString(),
        finished_at: null,
        final_status: null,
        events: [],
    };

    function persist() {
        fs.writeFileSync(filepath, JSON.stringify(logData, null, 2), 'utf8');
    }

    function emit(level, step, message, meta = {}, error = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            step: step || null,
            message,
        };

        if (meta && Object.keys(meta).length > 0) {
            entry.meta = sanitizeForLog(meta);
        }
        if (error) {
            entry.error = formatError(error);
        }

        logData.events.push(entry);
        persist();

        const consoleMeta = { ...entry.meta };
        if (entry.error) {
            consoleMeta.error = entry.error.message;
        }
        writeToConsole(level, buildConsoleLine(level, jobId, step, message), consoleMeta);
    }

    return {
        get logFile() {
            return filename;
        },

        info(step, message, meta) {
            emit('INFO', step, message, meta);
        },

        success(step, message, meta) {
            emit('SUCCESS', step, message, meta);
        },

        warn(step, message, meta) {
            emit('WARN', step, message, meta);
        },

        error(step, message, error, meta) {
            emit('ERROR', step, message, meta, error);
        },

        finalize(finalStatus, meta = {}) {
            logData.finished_at = new Date().toISOString();
            logData.final_status = finalStatus;
            emit('INFO', 'job', `Job finished with status: ${finalStatus}`, meta);
        },
    };
}

function logHostedJobEvent(level, { jobId, step, message, meta, error }) {
    const line = buildConsoleLine(level, jobId, step, message);
    const consoleMeta = { ...sanitizeForLog(meta || {}) };
    if (error) {
        consoleMeta.error = formatError(error)?.message;
    }
    writeToConsole(level, line, consoleMeta);
}

export {
    createHostedJobLogger,
    logHostedJobEvent,
    HOSTED_JOB_LOG_DIR,
};
