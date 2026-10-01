import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import requireAdmin from '../middleware/adminMiddleware.js';
import { IMAGE_TYPES, MAX_IMAGES } from '../controllers/shopProjectController.js';
import * as shopProjectController from '../controllers/shopProjectController.js';

const router = express.Router();
const shopImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: MAX_IMAGES,
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter(_req, file, callback) {
        if (!IMAGE_TYPES[file.mimetype]) {
            callback(new Error('Only PNG, JPEG, and WebP images are allowed'));
            return;
        }
        callback(null, true);
    },
});

function handleShopImageUpload(req, res, next) {
    shopImageUpload.array('images', MAX_IMAGES)(req, res, (error) => {
        if (!error) {
            return next();
        }

        return res.status(400).json({
            status: 400,
            message: error.message || 'Could not upload images',
        });
    });
}

router.get('/public/shop/projects', shopProjectController.listPublicShopProjects);
router.get('/public/shop/projects/:slug/images/:imageId', shopProjectController.getPublicShopProjectImage);
router.get('/public/shop/projects/:slug', shopProjectController.getPublicShopProject);

router.get(
    '/admin/shop/projects',
    authMiddleware,
    requireAdmin,
    shopProjectController.listAdminShopProjects
);
router.post(
    '/admin/shop/projects',
    authMiddleware,
    requireAdmin,
    shopProjectController.createAdminShopProject
);
router.put(
    '/admin/shop/projects/:slug',
    authMiddleware,
    requireAdmin,
    shopProjectController.updateAdminShopProject
);
router.post(
    '/admin/shop/projects/:slug/images',
    authMiddleware,
    requireAdmin,
    handleShopImageUpload,
    shopProjectController.uploadAdminShopProjectImages
);
router.delete(
    '/admin/shop/projects/:slug/images/:imageId',
    authMiddleware,
    requireAdmin,
    shopProjectController.deleteAdminShopProjectImage
);
router.delete(
    '/admin/shop/projects/:slug',
    authMiddleware,
    requireAdmin,
    shopProjectController.deleteAdminShopProject
);

export default router;
