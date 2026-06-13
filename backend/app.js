import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { fileURLToPath } from 'node:url';
import logger, { isProbeRequest } from './middleware/loggerMiddleware.js';
import userRoutes from './routes/userRoutes.js';
import pageIndexRoutes from './routes/pageIndexRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import ragChatRoutes from './routes/RagChatRoutes.js';
import PaymentRouter from './routes/paymentRoutes.js';
import pageIndexAuthRoutes from './routes/pageindexAuthRoutes.js';
import pageIndexHostedJobRoutes from './routes/pageIndexHostedJobRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import { startHostedJobRecovery } from './services/pageindexHosted/jobRecovery.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3075;

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(helmet());
app.use((req, res, next) => {
    if (isProbeRequest(req.url)) {
        return res.status(404).end();
    }
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(logger);

app.use(userRoutes);
app.use(pageIndexRoutes);
app.use(catalogRoutes);
app.use(ragChatRoutes);
app.use(PaymentRouter);
app.use(pageIndexAuthRoutes);
app.use(pageIndexHostedJobRoutes);
app.use(contactRoutes);
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'paperAI API is running',
        version: '1.0.0',
        status: 'ok',
    });
});

const isMainModule =
    import.meta.main ??
    (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);

if (isMainModule) {
    app.listen(port, () => {
        console.log(`🚀 paperAI API listening at http://localhost:${port}`);

    });
}

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'page-index-chatbot';
if (MONGODB_URI) {
    mongoose
        .connect(MONGODB_URI , {
            dbName: MONGODB_DB_NAME
        })
        .then(async () => {
            console.log('✅ Connected to MongoDB');
            startHostedJobRecovery();
        })
        .catch((err) => {
            console.error('❌ MongoDB connection error:', err.message);
        });
} else {
    console.warn('⚠️  MONGODB_URI not set — auth routes unavailable.');
}

export default app;
