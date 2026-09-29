// Keep in sync with frontend/data/projects.json when adding items.
const shopProducts = {
    'document-ai': {
        title: 'Project - Namste AI',
        currentPrice: 499,
        active: true,
    },
};

function getShopProduct(slug) {
    if (!slug || typeof slug !== 'string') {
        return null;
    }
    const product = shopProducts[slug];
    if (!product || product.active === false) {
        return null;
    }
    return { slug, ...product };
}

export { shopProducts, getShopProduct };
