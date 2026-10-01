import ShopProject from '../models/shopProjectModel.js';

const DEFAULT_SHOP_PROJECT = {
    slug: 'document-ai',
    title: 'Project - Namste AI',
    description:
        "Namste AI is designed to take you from strong AI fundamentals to practical AI engineering. You'll learn how modern AI systems work, work with leading model APIs, build real-world AI applications, and understand the practices needed to make them reliable and production-ready.\n\nThe course takes a JavaScript-first approach, with Python introduced when it adds genuine value. You’ll work across different models, databases, APIs, and tools, giving you the flexibility to understand AI beyond any single platform or framework.\n\nThis is not a placement-preparation or job-guarantee program. The focus is on building strong fundamentals, developing practical engineering skills, and giving you the confidence to design and build meaningful AI-powered products.\n\n It has 23 videos. including Season 1 and Season 2.",
    original_price: 6969,
    current_price: 499,
    active: true,
    images: [],
};

async function ensureDefaultShopProject() {
    const existing = await ShopProject.findOne({ slug: DEFAULT_SHOP_PROJECT.slug }).select('_id').lean();
    if (existing) {
        return existing;
    }

    return ShopProject.create(DEFAULT_SHOP_PROJECT);
}

export { DEFAULT_SHOP_PROJECT, ensureDefaultShopProject };
