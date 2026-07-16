/**
 * Block search crawlers and AI scrapers from the public API host.
 * Polite bots also get Disallow-all via GET /robots.txt.
 */

const CRAWLER_UA =
    /\b(googlebot|googleother|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex(bot|images)|facebookexternalhit|facebot|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|amazonbot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|ccbot|cohere-ai|diffbot|imagesiftbot|omgilibot|youbot|perplexitybot|meta-externalagent|meta-externalfetcher|ia_archiver|sogou|exabot|seznambot|crawler|spider|scrapy)\b/i;

const CRAWLER_FROM = /\bgooglebot\b/i;

export function isCrawlerRequest(req) {
    const ua = req.get('user-agent') || '';
    const from = req.get('from') || '';
    return CRAWLER_UA.test(ua) || CRAWLER_FROM.test(from);
}

const blockCrawlers = (req, res, next) => {
    // Always allow robots.txt so crawlers learn not to index this host
    if (req.method === 'GET' && (req.path === '/robots.txt' || req.url === '/robots.txt')) {
        return next();
    }

    if (!isCrawlerRequest(req)) {
        return next();
    }

    console.log(`[BE] blocked crawler ${req.method} ${req.originalUrl || req.url}`);
    return res.status(403).json({
        status: 403,
        message: 'Crawlers and bots are not allowed on this API.',
    });
};

export default blockCrawlers;
