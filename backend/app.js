const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3075;

// Middleware
const cors = require('cors');
const logger = require('./middleware/loggerMiddleware');
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
app.use(express.json());
app.use(logger);
app.use(express.urlencoded({ extended: true }));

// Routes
const userRoutes = require('./routes/userRoutes');
const pageIndexRoutes = require('./routes/pageIndexRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const ragChatRoutes = require('./routes/RagChatRoutes');
const PaymentRouter = require('./routes/paymentRoutes');
const pageIndexAuthRoutes = require('./routes/pageindexAuthRoutes');
const pageIndexHostedJobRoutes = require('./routes/pageIndexHostedJobRoutes');
const { startHostedJobRecovery } = require('./services/pageindexHosted/jobRecovery');
app.use(userRoutes);
app.use(pageIndexRoutes);
app.use(catalogRoutes);
app.use(ragChatRoutes);
app.use(PaymentRouter);
app.use(pageIndexAuthRoutes);
app.use(pageIndexHostedJobRoutes);
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Page Index Chatbot API is running',
        version: '1.0.0',
        status: 'ok',
    });
});
// Start server — only when run directly (not during tests)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`🚀 Page Index Chatbot API listening at http://localhost:${port}`);

    });
}

// MongoDB Connection (non-fatal — auth routes require DB, task routes work without it)
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'page-index-chatbot';
if (MONGODB_URI) {
    mongoose
        .connect(MONGODB_URI , {
            dbName: MONGODB_DB_NAME
        })
        .then(() => {
            console.log('✅ Connected to MongoDB');
            startHostedJobRecovery();
        })
        .catch((err) => {
            console.error('❌ MongoDB connection error:', err.message);
        });
} else {
    console.warn('⚠️  MONGODB_URI not set — auth routes unavailable.');
}

module.exports = app;
