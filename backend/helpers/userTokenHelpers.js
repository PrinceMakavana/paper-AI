import mongoose from 'mongoose';
import User from '../models/userModel.js';

const TOKEN_EXHAUSTED_MESSAGE = 'Token balance exhausted.';
const LOCAL_CATALOG_FIND_TOKEN_COST = Number(process.env.LOCAL_CATALOG_FIND_TOKEN_COST ?? 600);

class TokenBalanceError extends Error {
    constructor(message = TOKEN_EXHAUSTED_MESSAGE) {
        super(message);
        this.name = 'TokenBalanceError';
        this.statusCode = 402;
    }
}

function normalizeTokenCount(value) {
    const count = Number(value ?? 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function getUserTokenBalance(userId) {
    const user = await User.findById(userId).select('available_token_count');
    if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    return normalizeTokenCount(user.available_token_count);
}

async function assertUserHasTokens(userId) {
    const availableTokenCount = await getUserTokenBalance(userId);
    if (availableTokenCount <= 0) {
        throw new TokenBalanceError();
    }

    return availableTokenCount;
}

async function assertUserHasMinTokens(userId, minTokens) {
    const required = normalizeTokenCount(minTokens);
    const availableTokenCount = await getUserTokenBalance(userId);
    if (required > 0 && availableTokenCount < required) {
        throw new TokenBalanceError();
    }

    return availableTokenCount;
}

async function consumeUserTokens(userId, usedTokens) {
    const tokenDelta = normalizeTokenCount(usedTokens);
    if (tokenDelta <= 0) {
        return getUserTokenBalance(userId);
    }

    const objectId = new mongoose.Types.ObjectId(userId);
    const result = await User.collection.findOneAndUpdate(
        { _id: objectId },
        [
            {
                $set: {
                    available_token_count: {
                        $max: [
                            0,
                            { $subtract: [{ $ifNull: ['$available_token_count', 0] }, tokenDelta] },
                        ],
                    },
                },
            },
        ],
        { returnDocument: 'after' }
    );

    const updatedUser = result?.value || result;
    if (!updatedUser) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    return normalizeTokenCount(updatedUser.available_token_count);
}

function isTokenBalanceError(error) {
    return error instanceof TokenBalanceError || error?.statusCode === 402;
}

export {
    LOCAL_CATALOG_FIND_TOKEN_COST,
    TOKEN_EXHAUSTED_MESSAGE,
    TokenBalanceError,
    assertUserHasMinTokens,
    assertUserHasTokens,
    consumeUserTokens,
    getUserTokenBalance,
    isTokenBalanceError,
};
