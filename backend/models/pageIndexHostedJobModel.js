const mongoose = require('mongoose');
const {
    JOB_STEPS,
    JOB_STATUS,
    HOSTED_INDEX_STATUS,
    DEFAULT_MAX_RETRIES_PER_STEP,
    defaultCompletedSteps,
    defaultStepRetries,
} = require('../utils/pageindexHostedJobConstants');

const attemptLogSchema = new mongoose.Schema(
    {
        step: { type: String, required: true },
        attempt: { type: Number, required: true },
        at: { type: Date, default: Date.now },
        message: { type: String, default: '' },
    },
    { _id: false },
);

const pageIndexHostedJobSchema = new mongoose.Schema(
    {
        user_id: {
            type: String,
            required: [true, 'User ID is required'],
            trim: true,
            index: true,
        },
        job_status: {
            type: String,
            enum: Object.values(JOB_STATUS),
            default: JOB_STATUS.PENDING,
            index: true,
        },
        current_step: {
            type: String,
            enum: [...Object.values(JOB_STEPS), JOB_STEPS.DONE],
            default: JOB_STEPS.STEP1_ACCOUNT,
        },
        completed_steps: {
            type: mongoose.Schema.Types.Mixed,
            default: defaultCompletedSteps,
        },
        step_retries: {
            type: mongoose.Schema.Types.Mixed,
            default: defaultStepRetries,
        },
        max_retries_per_step: {
            type: Number,
            default: DEFAULT_MAX_RETRIES_PER_STEP,
        },
        next_retry_at: {
            type: Date,
            default: null,
            index: true,
        },
        input: {
            source_email: { type: String, required: true, trim: true },
            has_file: { type: Boolean, default: false },
            original_filename: { type: String, default: null },
            mime_type: { type: String, default: null },
            file_size: { type: Number, default: null },
        },
        pageindex_email: {
            type: String,
            default: null,
            trim: true,
        },
        pageindex_password_enc: {
            type: String,
            default: null,
        },
        pageindex_api_key_enc: {
            type: String,
            default: null,
        },
        api_key_name: {
            type: String,
            default: null,
            trim: true,
        },
        hosted_document_id: {
            type: String,
            default: null,
            trim: true,
        },
        page_count: {
            type: Number,
            default: null,
        },
        page_credits_charged: {
            type: Number,
            default: 0,
        },
        page_credits_refunded: {
            type: Boolean,
            default: false,
        },
        estimated_time: {
            type: Number,
            default: null,
        },
        index_status: {
            type: String,
            enum: Object.values(HOSTED_INDEX_STATUS),
            default: HOSTED_INDEX_STATUS.SKIPPED,
        },
        retrieval_ready: {
            type: Boolean,
            default: null,
        },
        file_staging_path: {
            type: String,
            default: null,
            trim: true,
        },
        linked_document_id: {
            type: String,
            default: null,
            trim: true,
        },
        last_error: {
            type: String,
            default: null,
        },
        last_error_step: {
            type: String,
            default: null,
        },
        attempt_log: {
            type: [attemptLogSchema],
            default: [],
        },
        completed_at: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

pageIndexHostedJobSchema.index({ user_id: 1, createdAt: -1 });
pageIndexHostedJobSchema.index({ job_status: 1, next_retry_at: 1 });

module.exports = mongoose.model('pageindex_hosted_jobs', pageIndexHostedJobSchema);
