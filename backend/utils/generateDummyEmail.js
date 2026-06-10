const crypto = require('crypto');

function generateDummySourceEmail() {
    const token = crypto.randomBytes(8).toString('hex');
    // Rendom Name of 8 characters
    const name = crypto.randomBytes(8).toString('hex');
    return `${name}-${token}@yopmail.com`;
}

module.exports = {
    generateDummySourceEmail,
};
