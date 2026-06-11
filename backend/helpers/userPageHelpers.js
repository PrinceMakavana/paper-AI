import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { updateHostedJob } from './pageIndexHostedJobHelpers.js';

const PAGE_EXHAUSTED_MESSAGE = 'Page credits exhausted.';

class PageBalanceError extends Error {
    constructor(message = PAGE_EXHAUSTED_MESSAGE) {
        super(message);
        this.name = 'PageBalanceError';
        this.statusCode = 402;
    }
}

function toPageBalance(value) {
    const count = Number(value ?? 0);
    if (!Number.isFinite(count)) {
        return 0;
    }
    return Math.max(0, Math.floor(count));
}

function normalizePageCount(value) {
    const count = Number(value ?? 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function getUserPageBalance(userId) {
    const objectId = new mongoose.Types.ObjectId(userId);
    const doc = await User.collection.findOne(
        { _id: objectId },
        { projection: { available_page_count: 1 } }
    );
    if (!doc) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    return toPageBalance(doc.available_page_count);
}

async function assertUserHasPages(userId, requiredPages) {
    const required = normalizePageCount(requiredPages);
    if (required <= 0) {
        return getUserPageBalance(userId);
    }

    const availablePageCount = await getUserPageBalance(userId);
    if (availablePageCount < required) {
        throw new PageBalanceError(
            `Not enough page credits. Need ${required}, have ${availablePageCount}.`
        );
    }

    return availablePageCount;
}

async function consumeUserPages(userId, usedPages) {
    const pageDelta = normalizePageCount(usedPages);
    if (pageDelta <= 0) {
        return getUserPageBalance(userId);
    }

    const objectId = new mongoose.Types.ObjectId(userId);
    const result = await User.collection.findOneAndUpdate(
        {
            _id: objectId,
            $expr: {
                $gte: [{ $ifNull: ['$available_page_count', 0] }, pageDelta],
            },
        },
        [
            {
                $set: {
                    available_page_count: {
                        $max: [
                            0,
                            { $subtract: [{ $ifNull: ['$available_page_count', 0] }, pageDelta] },
                        ],
                    },
                },
            },
        ],
        { returnDocument: 'after' }
    );

    const updatedUser = result?.value ?? result;
    if (!updatedUser) {
        throw new PageBalanceError();
    }

    return toPageBalance(updatedUser.available_page_count);
}

async function refundUserPages(userId, pages) {
    const pageDelta = normalizePageCount(pages);
    if (pageDelta <= 0) {
        return getUserPageBalance(userId);
    }

    const objectId = new mongoose.Types.ObjectId(userId);
    const result = await User.collection.findOneAndUpdate(
        { _id: objectId },
        { $inc: { available_page_count: pageDelta } },
        { returnDocument: 'after' }
    );

    const updatedUser = result?.value ?? result;
    if (!updatedUser) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    return toPageBalance(updatedUser.available_page_count);
}

async function refundPageCreditsForJob(job) {
    if (!job) return false;

    const charged = normalizePageCount(job.page_credits_charged);
    if (charged <= 0 || job.page_credits_refunded) {
        return false;
    }

    await refundUserPages(job.user_id, charged);
    await updateHostedJob(job._id.toString(), { page_credits_refunded: true });
    return true;
}

function isPageBalanceError(error) {
    return error instanceof PageBalanceError || error?.statusCode === 402;
}

export {
    PAGE_EXHAUSTED_MESSAGE,
    PageBalanceError,
    assertUserHasPages,
    consumeUserPages,
    getUserPageBalance,
    refundPageCreditsForJob,
    refundUserPages,
    isPageBalanceError,
};
