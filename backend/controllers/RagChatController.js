const { randomUUID } = require('crypto');
const { getModelConfig } = require('../utils/modelSelector');

let pinecone;

function contentToString(content) {
    if (typeof content === 'string') return content;
    if (content == null) return '';
    return JSON.stringify(content);
}

function getRagDependencies() {
    return {
        PDFLoader: require('@langchain/community/document_loaders/fs/pdf').PDFLoader,
        PineconeStore: require('@langchain/pinecone').PineconeStore,
        Pinecone: require('@pinecone-database/pinecone').Pinecone,
        RecursiveCharacterTextSplitter: require('langchain/text_splitter').RecursiveCharacterTextSplitter,
    };
}

function getPineconeIndex() {
    if (!process.env.PINECONE_INDEX_NAME) {
        throw new Error('PINECONE_INDEX_NAME is not configured');
    }

    if (!pinecone) {
        const { Pinecone } = getRagDependencies();
        pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
    }

    return pinecone.Index(process.env.PINECONE_INDEX_NAME);
}

async function chatWithDocument(req, res) {
    const { question, documentId, chatModel = 'gemini' } = req.body || {};

    try {
        if (!question?.trim() || !documentId) {
            return res.status(400).send('Missing question or documentId');
        }

        const { model, embeddings } = getModelConfig(chatModel);
        const { PineconeStore } = getRagDependencies();
        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: getPineconeIndex(),
            filter: { documentId },
        });

        const results = await vectorStore.similaritySearch(question, 4);

        if (results.length === 0) {
            return res.json({
                answer: "I don't know the answer to that question",
            });
        }

        const contextText = results.map((result) => result.pageContent).join('\n');
        const prompt = `You are a helpful AI assistant. Using the following context from a document.please answer the user's question accurately and concisely.
        if the context doesn't contain relevant information to answer the question, please say so.

        Context : ${contextText}

        Question : ${question}

        Answer :`;

        const response = await model.invoke(prompt);
        const answer = contentToString(response.content);

        return res.json({ answer });
    } catch (error) {
        console.error('Error processing question:', error);

        return res.status(500).json({
            answer: 'An error occurred while processing your question',
        });
    }
}

async function uploadDocument(req, res) {
    try {
        const { chatModel = 'gemini' } = req.body || {};

        if (!req.file) {
            return res.status(400).send('No File provided');
        }

        const { model, embeddings } = getModelConfig(chatModel);
        const { PDFLoader, PineconeStore, RecursiveCharacterTextSplitter } = getRagDependencies();
        const documentId = randomUUID();
        const blob = new Blob([req.file.buffer], {
            type: req.file.mimetype || 'application/pdf',
        });
        const loader = new PDFLoader(blob);
        const docs = await loader.load();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const splitDocs = await textSplitter.splitDocuments(docs);
        const docsWithMetadata = splitDocs.map((doc) => ({
            ...doc,
            metadata: {
                ...doc.metadata,
                documentId,
            },
        }));

        const firstChunk = splitDocs[0]?.pageContent || '';
        const summaryResponse = await model.invoke(`Summarize the following document: ${firstChunk}`);
        const summary = contentToString(summaryResponse.content);

        await PineconeStore.fromDocuments(docsWithMetadata, embeddings, {
            pineconeIndex: getPineconeIndex(),
        });

        return res.json({
            success: true,
            documentId,
            summary,
            pageCount: docs.length,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Error';
        console.error('Error processing document:', error);
        return res.status(500).send(message);
    }
}

module.exports = {
    uploadDocument,
    chatWithDocument,
};
