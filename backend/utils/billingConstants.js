const TOKENS_PER_RUPEE = 500;
const PAGES_PER_RUPEE = 1;
const SIGNUP_PAGE_BONUS = 300;

function pagesForTokenPurchase(tokenCount) {
    return Math.floor(Number(tokenCount) / TOKENS_PER_RUPEE);
}

export {
    TOKENS_PER_RUPEE,
    PAGES_PER_RUPEE,
    SIGNUP_PAGE_BONUS,
    pagesForTokenPurchase,
};
