const User = require('../models/userModel');

async function migrateExistingUsersEmailVerified() {
    const result = await User.updateMany(
        { isEmailVerified: { $exists: false } },
        { $set: { isEmailVerified: true } }
    );

    if (result.modifiedCount > 0) {
        console.log(`✅ Email verification migration: marked ${result.modifiedCount} existing user(s) as verified`);
    }
}

module.exports = { migrateExistingUsersEmailVerified };
