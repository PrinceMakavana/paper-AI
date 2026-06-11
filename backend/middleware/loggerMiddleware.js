
const logger = (req , res , next) => {
    console.log(`${req.method} Request Recieved on  ${req.url}`);
    next();
}

export default logger;
