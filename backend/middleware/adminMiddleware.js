import User from '../models/userModel.js';

const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user?.userId).select('isAdmin').lean();

        if (!user || user.isAdmin !== true) {
            return res.status(403).json({
                message: 'Admin access required.',
                status: 403,
            });
        }

        return next();
    } catch (error) {
        console.error('Admin authorization failed:', error);
        return res.status(500).json({
            message: 'Could not verify admin access.',
            status: 500,
        });
    }
};

export default requireAdmin;
