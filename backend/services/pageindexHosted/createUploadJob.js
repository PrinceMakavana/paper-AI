import { stageJobFile } from '../../utils/fileStaging.js';
import { generateDummySourceEmail } from '../../utils/generateDummyEmail.js';
import { logHostedJobEvent } from '../../utils/hostedJobLogger.js';
import { createHostedJob } from '../../helpers/pageIndexHostedJobHelpers.js';
import { createHostedUploadPlaceholderDocument } from '../../helpers/pageIndexDBHelpers.js';
import { uploadPdf } from '../../utils/s3Storage.js';
import { enqueueHostedJob } from './jobRunner.js';

async function createHostedUploadJob({
    user_id,
    file,
    source_email,
    page_credits_charged = 0,
}) {
    const dummyEmail = source_email || generateDummySourceEmail();

    logHostedJobEvent('INFO', {
        jobId: 'pending',
        step: 'create',
        message: 'Creating hosted upload job',
        meta: {
            userId: user_id,
            fileName: file.originalname,
            fileSize: file.size,
            sourceEmail: dummyEmail,
        },
    });

    const job = await createHostedJob({
        user_id,
        source_email: dummyEmail,
        has_file: true,
        original_filename: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        page_credits_charged,
    });

    const jobId = job._id.toString();

    logHostedJobEvent('SUCCESS', {
        jobId,
        step: 'create',
        message: 'Hosted job document created in database',
        meta: { userId: user_id, sourceEmail: dummyEmail },
    });

    const stagingPath = await stageJobFile(jobId, file.buffer);
    job.file_staging_path = stagingPath;
    job.linked_document_id = jobId;
    await job.save();

    logHostedJobEvent('SUCCESS', {
        jobId,
        step: 'create',
        message: 'PDF staged for upload step',
        meta: { stagingPath },
    });

    const pdfStorage = await uploadPdf(file.buffer, user_id, jobId);

    logHostedJobEvent('SUCCESS', {
        jobId,
        step: 'create',
        message: 'PDF uploaded to S3',
        meta: {
            pdfStoragePath: pdfStorage.storage_path,
            pdfS3Uri: pdfStorage.s3_uri,
        },
    });

    await createHostedUploadPlaceholderDocument({
        user_id,
        document_id: jobId,
        document_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        hosted_job_id: jobId,
        pdf_storage_path: pdfStorage.storage_path,
        pdf_s3_uri: pdfStorage.s3_uri,
        storage_status: 'pdf_uploaded',
    });

    logHostedJobEvent('SUCCESS', {
        jobId,
        step: 'create',
        message: 'Placeholder pageindex_documents row created',
        meta: { documentId: jobId },
    });

    enqueueHostedJob(jobId);

    logHostedJobEvent('INFO', {
        jobId,
        step: 'create',
        message: 'Hosted upload job setup complete — processing enqueued',
        meta: { documentId: jobId, dummyEmail },
    });

    return {
        job,
        documentId: jobId,
        dummyEmail,
    };
}

export {
    createHostedUploadJob,
};
