import mongoose from 'mongoose';

const oldPaperSchema = new mongoose.Schema(
    {
        year: { type: String, trim: true },
        link: { type: String, trim: true },
    },
    { _id: false }
);

const catalogBookSchema = new mongoose.Schema(
    {
        book_id: { type: String, trim: true },
        title: { type: String, trim: true },
        img: { type: String, trim: true },
        download_link: { type: String, trim: true },
        alt_data: { type: String, trim: true },
        pageindex_status: {
            type: String,
            enum: ['ready', 'pending', 'failed'],
            default: 'pending',
        },
        pageindex_s3_uri: { type: String, trim: true },
        pageindex_size_bytes: { type: Number },
        pdf_storage_path: { type: String, trim: true },
        pdf_s3_uri: { type: String, trim: true },
        token_count: { type: Number },
        indexed_at: { type: String, trim: true },
        index_version: { type: Number },
    },
    { _id: false }
);

const catalogSubjectSchema = new mongoose.Schema(
    {
        subject_code: {
            type: String,
            required: [true, 'Subject code is required'],
            unique: true,
            trim: true,
        },
        subject_name: {
            type: String,
            required: [true, 'Subject name is required'],
            trim: true,
        },
        known_as: { type: String, trim: true },
        chat_mode: { type: String, default: 'subject', trim: true },
        primary_book_id: { type: String, trim: true },
        pageindex_status: {
            type: String,
            enum: ['ready', 'partial', 'pending', 'failed'],
        },
        indexed_book_count: { type: Number },
        syllabus: { type: String, trim: true },
        paper_solution: { type: String, trim: true },
        prectical: { type: String, trim: true },
        viva_questions: { type: String, trim: true },
        imp_material: { type: String, trim: true },
        assignments: { type: String, trim: true },
        old_paper: { type: [oldPaperSchema], default: [] },
        books: { type: [catalogBookSchema], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model('catalog_subjects', catalogSubjectSchema, 'catalog_subjects');
