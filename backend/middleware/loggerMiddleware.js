const PROBE_PATH =
    /^\/(\.env|\.git|wp-config|config\.(ya?ml|php)|application\.)/i;

export const isProbeRequest = (url) =>
    PROBE_PATH.test(url) || url.includes('/.env');

const logger = (req, res, next) => {
    if (!isProbeRequest(req.url)) {
        console.log(`${req.method} Request Recieved on  ${req.url}`);
    }
    next();
};

export default logger;
