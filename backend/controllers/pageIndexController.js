import { PDFDocument } from 'pdf-lib';
import crypto from 'node:crypto';
import { getModelConfig } from '../utils/modelSelector.js';
import IndexStatus from '../utils/enums.js';
import { localStructureToTreeNodes } from '../utils/localPageindexTree.js';
import {
    buildContextFromTree,
    formatPagesArg,
    pickTopPagesForFetch,
    truncateToBudget,
} from '../utils/pageindexVectorlessContext.js';
import {
    getSubject,
    getSubjectChatSessionId,
} from '../helpers/catalogDataHelpers.js';
import { getCatalogGlobalSessionId } from '../helpers/catalogIndexHelpers.js';
import { runCatalogFindWithAi } from '../helpers/catalogFindAi.js';
import { runSubjectChatWithAi } from '../helpers/subjectChatAi.js';
import { getCatalogContributeFormUrl } from '../helpers/catalogQueryHelpers.js';
import { requirePlainString } from '../utils/validateInput.js';
import {
    deletePageIndexChatMessageById,
    deletePageIndexChatMessages,
    deletePageIndexDocument,
    getPageIndexChatMessages,
    getPageIndexDocumentByOwner,
    getPageIndexDocuments,
    mapChatMessageForClient,
    savePageIndexChatMessage,
    getPageIndexDocumentByOwnerFull,
    savePageIndexDocument,
    updatePageIndexDocumentStatus,
    updateHostedPageIndexDocumentStatus,
    verifyPageIndexDocumentOwner,
} from '../helpers/pageIndexDBHelpers.js';
import { getHostedJobByLinkedDocument } from '../helpers/pageIndexHostedJobHelpers.js';
import { mapHostedJobToIndexStatus } from '../services/pageindexHosted/jobHelpers.js';
import { createHostedUploadJob } from '../services/pageindexHosted/createUploadJob.js';
import { provisionMailTmInbox } from '../utils/provisionMailTmInbox.js';
import { encryptSecret } from '../utils/secretEncryption.js';
import { loadHostedTreeJson } from '../utils/hostedTreeStorage.js';
import { deleteObjectsByLocation } from '../utils/s3Storage.js';
import { logHostedJobEvent } from '../utils/hostedJobLogger.js';
import {
    assertUserHasTokens,
    consumeUserTokens,
    isTokenBalanceError,
} from '../helpers/userTokenHelpers.js';
import {
    assertUserHasPages,
    consumeUserPages,
    refundUserPages,
} from '../helpers/userPageHelpers.js';
const MAX_TREE_CONTEXT_CHARS = 28_000;
const MIN_CONTEXT_CHARS_BEFORE_PAGE_TEXT = 500;
const MAX_PAGE_TEXT_PAGES = 8;
const MAX_COMBINED_CONTEXT_CHARS = 40_000;
const DEFAULT_PDF_SIGNED_URL_EXPIRES_SECONDS = 300;

function getPdfSignedUrlExpiresSeconds() {
    const configured = Number(process.env.PDF_SIGNED_URL_EXPIRES_SECONDS);
    if (!Number.isFinite(configured) || configured <= 0) {
        return DEFAULT_PDF_SIGNED_URL_EXPIRES_SECONDS;
    }

    return Math.min(Math.floor(configured), 3600);
}

function awsEncode(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
        `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

function encodeS3KeyPath(key) {
    return key
        .split('/')
        .map((part) => awsEncode(part))
        .join('/');
}

function getS3Host(bucket, region) {
    return region === 'us-east-1'
        ? `${bucket}.s3.amazonaws.com`
        : `${bucket}.s3.${region}.amazonaws.com`;
}

function parseS3Location(location) {
    if (!location) return null;
    const trimmed = String(location).trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('s3://')) {
        const withoutProtocol = trimmed.slice('s3://'.length);
        const slashIndex = withoutProtocol.indexOf('/');
        if (slashIndex <= 0) return null;
        return {
            bucket: withoutProtocol.slice(0, slashIndex),
            key: withoutProtocol.slice(slashIndex + 1),
        };
    }

    try {
        const parsedUrl = new URL(trimmed);
        const hostParts = parsedUrl.hostname.split('.');
        if (parsedUrl.hostname.includes('.s3.') || parsedUrl.hostname.endsWith('.s3.amazonaws.com')) {
            return {
                bucket: hostParts[0],
                key: decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')),
            };
        }

        if (hostParts[0] === 's3' || hostParts[0].startsWith('s3-')) {
            const pathParts = parsedUrl.pathname.replace(/^\/+/, '').split('/');
            const bucket = pathParts.shift();
            if (bucket && pathParts.length) {
                return {
                    bucket,
                    key: decodeURIComponent(pathParts.join('/')),
                };
            }
        }
    } catch {
        // Treat non-URL values as bucket-relative keys below.
    }

    const bucket = process.env.PAGEINDEX_S3_BUCKET
        || process.env.S3_BUCKET
        || process.env.AWS_S3_BUCKET
        || process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) return null;

    return {
        bucket,
        key: trimmed.replace(/^\/+/, ''),
    };
}

function hmac(key, value, encoding) {
    return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function getSigningKey(secretAccessKey, dateStamp, region, service) {
    const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const dateRegionKey = hmac(dateKey, region);
    const dateRegionServiceKey = hmac(dateRegionKey, service);
    return hmac(dateRegionServiceKey, 'aws4_request');
}

function formatAmzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function buildSignedPdfUrl({ bucket, key, filename, expiresIn }) {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;

    if (!accessKeyId || !secretAccessKey) {
        const error = new Error('AWS credentials are not configured for PDF viewing.');
        error.statusCode = 500;
        throw error;
    }

    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const host = getS3Host(bucket, region);
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const responseDisposition = `inline; filename="${String(filename || 'source.pdf').replace(/"/g, '')}"`;

    const queryParams = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
        'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(expiresIn),
        'X-Amz-SignedHeaders': 'host',
        'response-content-disposition': responseDisposition,
    };

    if (sessionToken) {
        queryParams['X-Amz-Security-Token'] = sessionToken;
    }

    const canonicalQuery = Object.keys(queryParams)
        .sort()
        .map((name) => `${awsEncode(name)}=${awsEncode(queryParams[name])}`)
        .join('&');
    const canonicalUri = `/${encodeS3KeyPath(key)}`;
    const canonicalRequest = [
        'GET',
        canonicalUri,
        canonicalQuery,
        `host:${host}\n`,
        'host',
        'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256(canonicalRequest),
    ].join('\n');
    const signature = hmac(getSigningKey(secretAccessKey, dateStamp, region, 's3'), stringToSign, 'hex');

    return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function mapDocumentForClient(doc) {
    return {
        id: doc.document_id,
        filename: doc.document_name,
        uploadedAt: doc.createdAt,
        fileSize: doc.file_size ?? 0,
        summary: doc.summary ?? '',
        pageCount: doc.page_count ?? 0,
        indexStatus: doc.index_status ?? IndexStatus.UNKNOWN,
        tokenCount: doc.token_count ?? 0,
        pdfS3Uri: doc.pdf_s3_uri,
        pageindexS3Uri: doc.pageindex_s3_uri,
        storageStatus: doc.storage_status,
    };
}

function getPageIndexBaseUrl() {
    return process.env.PAGEINDEX_BACKEND_API_URL || process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';
}

function getRequestOrigin(req) {
    const configuredOrigin = (
        process.env.PUBLIC_API_URL
        || process.env.API_PUBLIC_URL
        || process.env.BACKEND_PUBLIC_URL
        || ''
    ).trim();
    if (configuredOrigin) {
        return configuredOrigin.replace(/\/+$/, '');
    }

    const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
    const proto = forwardedProto || req.protocol || 'http';
    const host = forwardedHost || req.get('host');

    return host ? `${proto}://${host}` : '';
}

function buildCatalogDownloadLinkResolver(req) {
    const origin = getRequestOrigin(req);
    return (url) => {
        const trimmed = String(url || '').trim();
        if (!trimmed.startsWith('s3://')) return trimmed;

        const path = `/public/catalog/download-url?url=${encodeURIComponent(trimmed)}`;
        return origin ? `${origin}${path}` : path;
    };
}

function getDefaultModelForProvider(modelProvider) {
    switch (modelProvider) {
        case 'ollama':
            return  process.env.OLLAMA_MODEL_NAME || 'llama3';
        case 'openai':
            return  process.env.OPENAI_MODEL_NAME || 'gpt-4o-mini';
        case 'claude':
        case 'anthropic':
            return  process.env.ANTHROPIC_MODEL_NAME || 'claude-3-5-sonnet-latest';
        case 'gemini':
        default:
            return  process.env.GEMINI_MODEL_NAME || 'gemini-3.1-flash-lite-preview';
    }
}

function getUploadModelSelection(body = {}) {
    const modelProvider = body.model_provider || body.modelProvider || body.chatModel || 'gemini';
    const model = body.model || getDefaultModelForProvider(modelProvider);

    return {
        modelProvider,
        model,
    };
}

function contentToString(content) {
    if (typeof content === 'string') return content;
    if (content == null) return '';
    return JSON.stringify(content);
}

function normalizeIndexStatus(status) {
    if (Object.values(IndexStatus).includes(status)) {
        return status;
    }

    return IndexStatus.UNKNOWN;
}

async function validatePdfFile(file) {
    const maxFileSize = process.env.MAX_FILE_SIZE || 10; //in mb
    const maxFilePageCount = process.env.MAX_FILE_PAGE_COUNT || 100; //in pages
    if (!file) {
        return { success: false, message: 'No File provided' };
    }

    if (file.mimetype !== 'application/pdf') {
        return { success: false, message: 'File must be a PDF' };
    }

    if (file.size > Number(maxFileSize) * 1024 * 1024) { //convert mb to bytes
        return { success: false, message: `File size has be less than ${maxFileSize} MB` };
    }

    const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    if (pageCount > Number(maxFilePageCount)) {
        return { success: false, message: `File page count has be less than ${maxFilePageCount} pages` };
    }

    return { success: true, pageCount };
}

async function uploadDocument(req, res) {
    try {
        const validation = await validatePdfFile(req.file);
        if (!validation.success) {
            return res.status(400).send(validation.message || 'Failed to upload document');
        }

        const pageCount = validation.pageCount;
        await assertUserHasTokens(req.user.userId);
        await assertUserHasPages(req.user.userId, pageCount);

        let availablePageCount = await consumeUserPages(req.user.userId, pageCount);

        logHostedJobEvent('INFO', {
            step: 'api',
            message: 'POST /pageindex/upload — starting hosted job flow',
            meta: {
                userId: req.user.userId,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                pageCount,
            },
        });

        const optionalEmail = req.body?.email;
        const { address: sourceEmail, password: mailTmPassword } = await provisionMailTmInbox(optionalEmail);

        let documentId;
        let job;
        try {
            ({ documentId, job } = await createHostedUploadJob({
                user_id: req.user.userId,
                file: req.file,
                source_email: sourceEmail,
                mailtm_password_enc: encryptSecret(mailTmPassword),
                page_credits_charged: pageCount,
            }));
        } catch (enqueueError) {
            availablePageCount = await refundUserPages(req.user.userId, pageCount);
            throw enqueueError;
        }

        logHostedJobEvent('SUCCESS', {
            jobId: job._id.toString(),
            step: 'api',
            message: 'POST /pageindex/upload accepted — job enqueued',
            meta: { documentId, sourceEmail, userId: req.user.userId, pageCount },
        });

        return res.json({
            success: true,
            documentId,
            summary: '',
            pageCount,
            available_page_count: availablePageCount,
        });
    } catch (error) {
        console.log('error from uploadDocument => ', error);
        logHostedJobEvent('ERROR', {
            step: 'api',
            message: 'POST /pageindex/upload failed',
            error,
            meta: { userId: req.user?.userId },
        });
        console.error('Error processing document:', error);
        const statusCode = error.statusCode || 500;
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return res.status(statusCode).json({ message, status: statusCode });
    }
}

async function questionVectorlessRag(req, res) {
    let savedUserMessage = null;
    const { question, documentId: rawDocumentId, chatModel } = req.body || {};
    const documentId = requirePlainString(rawDocumentId);

    try {
        const base = getPageIndexBaseUrl();

        if (!question?.trim() || !documentId) {
            return res.status(400).send('Missing question or documentId');
        }

        await assertUserHasTokens(req.user.userId);

        const document = await getPageIndexDocumentByOwnerFull({
            user_id: req.user.userId,
            document_id: documentId,
        });
        if (!document) {
            return res.status(404).json({
                answer: 'Document not found for this user.',
                status: 404,
            });
        }

        const { model } = getModelConfig(chatModel);

        let roots;
        if (document.source === 'hosted') {
            if (
                document.index_status !== IndexStatus.COMPLETE
                || !document.pageindex_s3_uri
            ) {
                return res.json({
                    answer: 'This document is not ready for questions yet. Please wait until indexing finishes and try again.',
                    status: 503,
                });
            }

            try {
                const tree = await loadHostedTreeJson({
                    pageindex_s3_uri: document.pageindex_s3_uri,
                });
                roots = Array.isArray(tree) ? tree : null;
            } catch (error) {
                console.error('hosted tree load failed:', error.message);
                return res.json({
                    answer: 'Could not load this document index. Please try again later.',
                    status: 404,
                });
            }
        } else {
            const statusRes = await fetch(`${base}/upload/${encodeURIComponent(documentId)}/status`);
            if (!statusRes.ok) {
                return res.json({
                    answer: 'Could not able to load this document. Please try again later.',
                    status: 404,
                });
            }

            const status = await statusRes.json();
            roots = localStructureToTreeNodes(status.page_index?.structure);
            if (status.job_status !== 'complete' || !roots?.length) {
                return res.json({
                    answer: 'This document is not ready for questions yet. Please wait until indexing finishes and try again.',
                    status: 503,
                });
            }
        }

        if (!roots?.length) {
            return res.json({
                answer: 'This document is not ready for questions yet. Please wait until indexing finishes and try again.',
                status: 503,
            });
        }

        let { context: contextStr } = buildContextFromTree(roots, question, MAX_TREE_CONTEXT_CHARS);

        if (document.source !== 'hosted' && contextStr.length < MIN_CONTEXT_CHARS_BEFORE_PAGE_TEXT) {
            const pagesToFetch = pickTopPagesForFetch(roots, question, MAX_PAGE_TEXT_PAGES);
            const pagesArg = formatPagesArg(pagesToFetch);

            try {
                const pageRes = await fetch(
                    `${base}/upload/${encodeURIComponent(documentId)}/page-text?pages=${encodeURIComponent(pagesArg)}`
                );
                if (pageRes.ok) {
                    const pageData = await pageRes.json();
                    const blobs = (pageData.pages || []).map((page) => `Page ${page.page}:\n${page.text}`);
                    const joined = blobs.join('\n\n');
                    contextStr = truncateToBudget(
                        [contextStr, joined].filter(Boolean).join('\n\n'),
                        MAX_COMBINED_CONTEXT_CHARS
                    );
                }
            } catch (error) {
                console.error('local page-text fallback failed:', error);
            }
        } else {
            contextStr = truncateToBudget(contextStr, MAX_TREE_CONTEXT_CHARS);
        }

        const prompt = `You are a helpful AI assistant. Using the following context from a document.please answer the user's question accurately and concisely.
        if the context doesn't contain relevant information to answer the question, please say so.

        Context : ${contextStr}

        Question : ${question}

        Answer :`;

        savedUserMessage = await savePageIndexChatMessage({
            user_id: req.user.userId,
            document_id: documentId,
            role: 'user',
            content: question.trim(),
            chat_model: chatModel,
            token_count: 0,
        });

        const response = await model.invoke(prompt);
        const answer = contentToString(response.content);
        const aiTokenCount = response.usage_metadata?.total_tokens ?? 0;
        const aiInputTokenCount = response.usage_metadata?.input_tokens ?? 0;
        const aiOutputTokenCount = response.usage_metadata?.output_tokens ?? 0;
        const availableTokenCount = await consumeUserTokens(req.user.userId, aiTokenCount);

        const savedAssistantMessage = await savePageIndexChatMessage({
            user_id: req.user.userId,
            document_id: documentId,
            previous_message_id: savedUserMessage._id.toString(),
            role: 'assistant',
            content: answer,
            chat_model: chatModel,
            token_count: aiTokenCount,
            input_token_count: aiInputTokenCount,
            output_token_count: aiOutputTokenCount,
        });

        return res.json({
            answer,
            message: mapChatMessageForClient(savedAssistantMessage),
            status: 200,
            available_token_count: availableTokenCount,
        });
    } catch (error) {
        if (savedUserMessage?._id) {
            try {
                await deletePageIndexChatMessageById({
                    user_id: req.user.userId,
                    message_id: savedUserMessage._id,
                });
            } catch (deleteError) {
                console.error('Failed to remove unsent user chat message:', deleteError);
            }
        }

        console.error('Error processing question (local vectorless):', error);
        return res.status(error.statusCode || 500).json({
            answer: error instanceof Error ? error.message : 'Failed to send question',
            message: isTokenBalanceError(error) ? error.message : undefined,
            status: error.statusCode || 500,
        });
    }
}

async function subjectQuestionVectorlessRag(req, res) {
    let savedUserMessage = null;
    const { question, subjectCode: rawSubjectCode, chatModel } = req.body || {};
    const subjectCode = requirePlainString(rawSubjectCode);

    try {
        if (!question?.trim() || !subjectCode) {
            return res.status(400).send('Missing question or subjectCode');
        }

        const sessionId = getSubjectChatSessionId(subjectCode);
        const { model } = getModelConfig(chatModel);
        const result = await runSubjectChatWithAi({
            question: question.trim(),
            subjectCode,
            model,
            userId: req.user.userId,
        });

        savedUserMessage = await savePageIndexChatMessage({
            user_id: req.user.userId,
            document_id: sessionId,
            role: 'user',
            content: question.trim(),
            chat_model: chatModel,
            token_count: 0,
        });

        const availableTokenCount = await consumeUserTokens(req.user.userId, result.aiTokenCount);

        const savedAssistantMessage = await savePageIndexChatMessage({
            user_id: req.user.userId,
            document_id: sessionId,
            previous_message_id: savedUserMessage._id.toString(),
            role: 'assistant',
            content: result.answer,
            chat_model: chatModel,
            token_count: result.aiTokenCount,
            input_token_count: result.aiInputTokenCount,
            output_token_count: result.aiOutputTokenCount,
        });

        return res.json({
            answer: result.answer,
            answer_source: result.answerSource,
            paper_solution_url: result.subjectMeta.paperSolution?.[0]?.url ?? null,
            message: mapChatMessageForClient(savedAssistantMessage),
            status: 200,
            available_token_count: availableTokenCount,
            subjectCode,
        });
    } catch (error) {
        if (savedUserMessage?._id) {
            try {
                await deletePageIndexChatMessageById({
                    user_id: req.user.userId,
                    message_id: savedUserMessage._id,
                });
            } catch (deleteError) {
                console.error('Failed to remove unsent subject chat message:', deleteError);
            }
        }

        console.error('Error processing subject question:', error);
        return res.status(error.statusCode || 500).json({
            answer: error instanceof Error ? error.message : 'Failed to send question',
            message: isTokenBalanceError(error) ? error.message : undefined,
            status: error.statusCode || 500,
        });
    }
}

async function getSubjectChatMessages(req, res) {
    try {
        const { subjectCode } = req.params;
        const sessionId = getSubjectChatSessionId(subjectCode);
        await getSubject(subjectCode);

        const messages = await getPageIndexChatMessages({
            user_id: req.user.userId,
            document_id: sessionId,
        });

        return res.json({
            status: 200,
            subjectCode,
            messages: messages.map((message) => ({
                ...mapChatMessageForClient(message),
                subjectCode,
            })),
        });
    } catch (error) {
        console.error('Error loading subject chat messages:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to load chat messages',
            status: error.statusCode || 500,
        });
    }
}

async function deleteSubjectChatMessages(req, res) {
    try {
        const { subjectCode } = req.params;
        const sessionId = getSubjectChatSessionId(subjectCode);
        await getSubject(subjectCode);

        const result = await deletePageIndexChatMessages({
            user_id: req.user.userId,
            document_id: sessionId,
        });

        return res.json({
            status: 200,
            deletedCount: result.deletedCount,
            subjectCode,
        });
    } catch (error) {
        console.error('Error deleting subject chat messages:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to delete chat messages',
            status: error.statusCode || 500,
        });
    }
}

async function catalogFindQuestion(req, res) {
    let savedUserMessage = null;
    const { question, chatModel } = req.body || {};
    const sessionId = getCatalogGlobalSessionId();

    try {
        if (!question?.trim()) {
            return res.status(400).send('Missing question');
        }

        const { model } = getModelConfig(chatModel);
        const result = await runCatalogFindWithAi({
            question: question.trim(),
            model,
            userId: req.user.userId,
            linkResolver: buildCatalogDownloadLinkResolver(req),
        });

        console.log('[CatalogFind] billed', JSON.stringify({
            question: question.trim(),
            answerSource: result.answerSource,
            tokenCost: result.aiTokenCount,
            availability: result.availability,
        }, null, 2));

        savedUserMessage = await savePageIndexChatMessage({
            user_id: req.user.userId,
            document_id: sessionId,
            role: 'user',
            content: question.trim(),
            chat_model: chatModel,
            token_count: 0,
        });

        const availableTokenCount = await consumeUserTokens(req.user.userId, result.aiTokenCount);

        const savedAssistantMessage = await savePageIndexChatMessage({
            user_id: req.user.userId,
            document_id: sessionId,
            previous_message_id: savedUserMessage._id.toString(),
            role: 'assistant',
            content: result.answer,
            chat_model: chatModel,
            token_count: result.aiTokenCount,
            input_token_count: result.aiInputTokenCount,
            output_token_count: result.aiOutputTokenCount,
        });

        return res.json({
            answer: result.answer,
            intent: result.intent,
            availability: result.availability,
            matches: result.matches,
            suggestedSubjectCodes: result.suggestedSubjectCodes,
            contribute_form_url: getCatalogContributeFormUrl() || null,
            answer_source: result.answerSource,
            token_count: result.aiTokenCount,
            message: mapChatMessageForClient(savedAssistantMessage),
            status: 200,
            available_token_count: availableTokenCount,
        });
    } catch (error) {
        if (savedUserMessage?._id) {
            try {
                await deletePageIndexChatMessageById({
                    user_id: req.user.userId,
                    message_id: savedUserMessage._id,
                });
            } catch (deleteError) {
                console.error('Failed to remove unsent catalog find message:', deleteError);
            }
        }

        console.error('Error processing catalog find question:', error);
        return res.status(error.statusCode || 500).json({
            answer: error instanceof Error ? error.message : 'Failed to find materials',
            message: isTokenBalanceError(error) ? error.message : undefined,
            status: error.statusCode || 500,
        });
    }
}

async function getCatalogChatMessages(req, res) {
    try {
        const sessionId = getCatalogGlobalSessionId();
        const messages = await getPageIndexChatMessages({
            user_id: req.user.userId,
            document_id: sessionId,
        });

        return res.json({
            status: 200,
            messages: messages.map((message) => mapChatMessageForClient(message)),
        });
    } catch (error) {
        console.error('Error loading catalog chat messages:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to load chat messages',
            status: error.statusCode || 500,
        });
    }
}

async function deleteCatalogChatMessages(req, res) {
    try {
        const sessionId = getCatalogGlobalSessionId();
        const result = await deletePageIndexChatMessages({
            user_id: req.user.userId,
            document_id: sessionId,
        });

        return res.json({
            status: 200,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting catalog chat messages:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to delete chat messages',
            status: error.statusCode || 500,
        });
    }
}

async function getChatMessages(req, res) {
    try {
        const { documentId } = req.params;
        const documentExists = await verifyPageIndexDocumentOwner({
            user_id: req.user.userId,
            document_id: documentId,
        });

        if (!documentExists) {
            return res.status(404).json({
                message: 'Document not found for this user.',
                status: 404,
            });
        }

        const messages = await getPageIndexChatMessages({
            user_id: req.user.userId,
            document_id: documentId,
        });

        return res.json({
            status: 200,
            messages: messages.map(mapChatMessageForClient),
        });
    } catch (error) {
        console.error('Error loading chat messages:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to load chat messages',
            status: error.statusCode || 500,
        });
    }
}

async function deleteChatMessages(req, res) {
    try {
        const { documentId } = req.params;
        const documentExists = await verifyPageIndexDocumentOwner({
            user_id: req.user.userId,
            document_id: documentId,
        });

        if (!documentExists) {
            return res.status(404).json({
                message: 'Document not found for this user.',
                status: 404,
            });
        }

        const result = await deletePageIndexChatMessages({
            user_id: req.user.userId,
            document_id: documentId,
        });

        return res.json({
            status: 200,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting chat messages:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to delete chat messages',
            status: error.statusCode || 500,
        });
    }
}

async function deleteDocument(req, res) {
    try {
        const { documentId } = req.params;
        const document = await getPageIndexDocumentByOwnerFull({
            user_id: req.user.userId,
            document_id: documentId,
        });

        if (!document) {
            return res.status(404).json({
                message: 'Document not found for this user.',
                status: 404,
            });
        }

        try {
            await deleteObjectsByLocation([
                { s3Uri: document.pdf_s3_uri, storagePath: document.pdf_storage_path },
                { s3Uri: document.pageindex_s3_uri },
            ]);
        } catch (s3Error) {
            console.error('Error deleting S3 objects for document:', documentId, s3Error);
        }

        const chatResult = await deletePageIndexChatMessages({
            user_id: req.user.userId,
            document_id: documentId,
        });
        const documentResult = await deletePageIndexDocument({
            user_id: req.user.userId,
            document_id: documentId,
        });

        return res.json({
            status: 200,
            deletedDocumentCount: documentResult.deletedCount,
            deletedChatMessageCount: chatResult.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to delete document',
            status: error.statusCode || 500,
        });
    }
}

async function getDocumentPdfUrl(req, res) {
    try {
        const { documentId } = req.params;
        const document = await getPageIndexDocumentByOwner({
            user_id: req.user.userId,
            document_id: documentId,
        });

        if (!document) {
            return res.status(404).json({
                message: 'Document not found for this user.',
                status: 404,
            });
        }

        const location = document.pdf_s3_uri || document.pdf_storage_path;
        const parsedLocation = parseS3Location(location);
        if (!parsedLocation?.bucket || !parsedLocation?.key) {
            return res.status(409).json({
                message: 'PDF storage location is not available for this document.',
                status: 409,
            });
        }

        const expiresIn = getPdfSignedUrlExpiresSeconds();
        const url = buildSignedPdfUrl({
            bucket: parsedLocation.bucket,
            key: parsedLocation.key,
            filename: document.document_name,
            expiresIn,
        });

        return res.json({
            status: 200,
            url,
            expiresIn,
        });
    } catch (error) {
        console.error('Error creating PDF signed URL:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to create PDF view URL',
            status: error.statusCode || 500,
        });
    }
}

async function getDocuments(req, res) {
    try {
        const docs = await getPageIndexDocuments({ user_id: req.user.userId });
        return res.json({
            status: 200,
            documents: docs.map(mapDocumentForClient),
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to fetch documents',
            status: error.statusCode || 500,
        });
    }
}

async function getDocumentIndexStatus(req, res) {
    try {
        const { documentId } = req.params;
        const document = await getPageIndexDocumentByOwnerFull({
            user_id: req.user.userId,
            document_id: documentId,
        });

        if (!document) {
            return res.status(404).json({
                message: 'Document not found for this user.',
                status: 404,
            });
        }

        if (document.source === 'hosted') {
            const job = await getHostedJobByLinkedDocument({
                user_id: req.user.userId,
                document_id: documentId,
            });

            const indexStatus = mapHostedJobToIndexStatus(job);
            const updatedDocument = await updateHostedPageIndexDocumentStatus({
                user_id: req.user.userId,
                document_id: documentId,
                index_status: indexStatus,
                error_message: job?.last_error ?? document.error_message,
                page_count: job?.page_count ?? document.page_count,
            });

            return res.json({
                status: 200,
                documentId,
                indexStatus,
                indexed: indexStatus === IndexStatus.COMPLETE,
                error: job?.last_error ?? document.error_message,
                jobStatus: job?.job_status,
                currentStep: job?.current_step,
                document: mapDocumentForClient(updatedDocument || document),
            });
        }

        const response = await fetch(`${getPageIndexBaseUrl()}/upload/${encodeURIComponent(documentId)}/status`);
        if (!response.ok) {
            const message = await response.text();
            return res.status(response.status).json({
                message: message || 'Failed to fetch document index status',
                status: response.status,
            });
        }

        const data = await response.json();
        const indexStatus = normalizeIndexStatus(data.index_status || data.job_status);
        const updatedDocument = await updatePageIndexDocumentStatus({
            user_id: req.user.userId,
            document_id: documentId,
            index_status: indexStatus,
            error_message: data.error,
            pdf_storage_path: data.pdf_storage_path,
            pdf_s3_uri: data.pdf_s3_uri,
            pageindex_s3_uri: data.pageindex_s3_uri,
            storage_status: data.storage_status,
            storage_error_message: data.storage_error_message,
        });

        return res.json({
            status: 200,
            documentId,
            indexStatus,
            indexed: !!data.indexed,
            error: data.error,
            document: updatedDocument ? mapDocumentForClient(updatedDocument) : undefined,
        });
    } catch (error) {
        console.error('Error fetching document index status:', error);
        return res.status(error.statusCode || 500).json({
            message: error instanceof Error ? error.message : 'Failed to fetch document index status',
            status: error.statusCode || 500,
        });
    }
}


export {
    buildSignedPdfUrl,
    catalogFindQuestion,
    deleteCatalogChatMessages,
    deleteChatMessages,
    deleteDocument,
    deleteSubjectChatMessages,
    getCatalogChatMessages,
    getDocumentPdfUrl,
    getChatMessages,
    getDocumentIndexStatus,
    getDocuments,
    getPdfSignedUrlExpiresSeconds,
    getSubjectChatMessages,
    parseS3Location,
    uploadDocument,
    validatePdfFile,
    questionVectorlessRag,
    subjectQuestionVectorlessRag,
};
