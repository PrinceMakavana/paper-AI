import crypto from 'node:crypto';
import ProductOrder from '../models/productOrder.js';
import ShopProject from '../models/shopProjectModel.js';
import {
    buildShopProjectImageKey,
    deleteObjectsByLocation,
    downloadObject,
    uploadBytes,
} from '../utils/s3Storage.js';

const SLUG_PATTERN = /^[a-z0-9-]{2,64}$/;
const MAX_IMAGES = 8;
const IMAGE_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
};

function normalizeSlug(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidSlug(slug) {
    return SLUG_PATTERN.test(slug);
}

function imagePath(slug, imageId) {
    return `/public/shop/projects/${encodeURIComponent(slug)}/images/${encodeURIComponent(imageId)}`;
}

function imageRecordId(image) {
    return image?.image_id || image?.id;
}

function sortedImages(project) {
    return [...(project.images || [])].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function toPublicProject(project) {
    const images = sortedImages(project);
    return {
        slug: project.slug,
        title: project.title,
        description: project.description,
        originalPrice: project.original_price,
        currentPrice: project.current_price,
        images: images.map((image) => imagePath(project.slug, imageRecordId(image))),
    };
}

function toAdminProject(project) {
    const images = sortedImages(project);
    return {
        ...toPublicProject(project),
        active: project.active !== false,
        images: images.map((image) => ({
            id: imageRecordId(image),
            url: imagePath(project.slug, imageRecordId(image)),
            originalName: image.original_name || '',
            sortOrder: image.sort_order ?? 0,
        })),
    };
}

function parsePrice(value, field, { min = 0 } = {}) {
    const number = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);
    if (!Number.isFinite(number) || number < min) {
        return { error: `${field} must be a number greater than or equal to ${min}` };
    }
    return { value: Math.round(number * 100) / 100 };
}

function readProjectFields(body, { partial = false } = {}) {
    const fields = {};
    const errors = [];

    if (!partial || body.slug !== undefined) {
        const slug = normalizeSlug(body.slug);
        if (!isValidSlug(slug)) {
            errors.push('Slug must be 2-64 characters and use lowercase letters, numbers, and hyphens');
        } else {
            fields.slug = slug;
        }
    }

    if (!partial || body.title !== undefined) {
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title) {
            errors.push('Title is required');
        } else {
            fields.title = title;
        }
    }

    if (!partial || body.description !== undefined) {
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        if (!description) {
            errors.push('Description is required');
        } else {
            fields.description = description;
        }
    }

    if (!partial || body.originalPrice !== undefined) {
        const originalPrice = parsePrice(body.originalPrice, 'Original price', { min: 0 });
        if (originalPrice.error) {
            errors.push(originalPrice.error);
        } else {
            fields.original_price = originalPrice.value;
        }
    }

    if (!partial || body.currentPrice !== undefined) {
        const currentPrice = parsePrice(body.currentPrice, 'Current price', { min: 1 });
        if (currentPrice.error) {
            errors.push(currentPrice.error);
        } else {
            fields.current_price = currentPrice.value;
        }
    }

    if (body.active !== undefined) {
        fields.active = body.active === true || body.active === 'true';
    }

    return { fields, errors };
}

async function getActiveShopProduct(slug) {
    const normalized = normalizeSlug(slug);
    if (!isValidSlug(normalized)) {
        return null;
    }

    const project = await ShopProject.findOne({ slug: normalized, active: true })
        .select('slug title current_price')
        .lean();

    if (!project) {
        return null;
    }

    return {
        slug: project.slug,
        title: project.title,
        currentPrice: project.current_price,
    };
}

async function listPublicShopProjects(_req, res) {
    try {
        const projects = await ShopProject.find({ active: true }).sort({ createdAt: 1 }).lean();
        return res.status(200).json({
            status: 200,
            projects: projects.map(toPublicProject),
            total: projects.length,
        });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function getPublicShopProject(req, res) {
    try {
        const slug = normalizeSlug(req.params.slug);
        if (!isValidSlug(slug)) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const project = await ShopProject.findOne({ slug, active: true }).lean();
        if (!project) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        return res.status(200).json({
            status: 200,
            project: toPublicProject(project),
        });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function getPublicShopProjectImage(req, res) {
    try {
        const slug = normalizeSlug(req.params.slug);
        const imageId = String(req.params.imageId || '').trim();
        if (!isValidSlug(slug) || !imageId) {
            return res.status(404).json({ status: 404, message: 'Image not found' });
        }

        const project = await ShopProject.findOne({ slug }).select('images').lean();
        const image = (project?.images || []).find((item) => imageRecordId(item) === imageId);
        if (!image) {
            return res.status(404).json({ status: 404, message: 'Image not found' });
        }

        const file = await downloadObject({
            s3Uri: image.s3_uri,
            storagePath: image.storage_path,
        });

        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Cache-Control', 'public, max-age=86400');
        res.type(image.content_type || file.contentType);
        return res.send(file.buffer);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ status, message: error.message });
    }
}

async function listAdminShopProjects(_req, res) {
    try {
        const projects = await ShopProject.find({}).sort({ createdAt: 1 }).lean();
        return res.status(200).json({
            status: 200,
            projects: projects.map(toAdminProject),
            total: projects.length,
        });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function createAdminShopProject(req, res) {
    try {
        const { fields, errors } = readProjectFields(req.body);
        if (errors.length) {
            return res.status(400).json({ status: 400, message: errors[0] });
        }

        const existing = await ShopProject.findOne({ slug: fields.slug }).select('_id').lean();
        if (existing) {
            return res.status(409).json({ status: 409, message: 'A project with this slug already exists' });
        }

        const project = await ShopProject.create({
            ...fields,
            active: fields.active !== undefined ? fields.active : true,
            images: [],
        });

        return res.status(201).json({
            status: 201,
            project: toAdminProject(project),
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ status: 409, message: 'A project with this slug already exists' });
        }
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function updateAdminShopProject(req, res) {
    try {
        const currentSlug = normalizeSlug(req.params.slug);
        if (!isValidSlug(currentSlug)) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const project = await ShopProject.findOne({ slug: currentSlug });
        if (!project) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const { fields, errors } = readProjectFields(req.body, { partial: true });
        if (errors.length) {
            return res.status(400).json({ status: 400, message: errors[0] });
        }

        if (fields.slug && fields.slug !== project.slug) {
            const orderCount = await ProductOrder.countDocuments({ product_slug: project.slug });
            if (orderCount > 0) {
                return res.status(409).json({
                    status: 409,
                    message: 'Slug cannot change because this project already has orders',
                });
            }

            const taken = await ShopProject.findOne({ slug: fields.slug }).select('_id').lean();
            if (taken) {
                return res.status(409).json({ status: 409, message: 'A project with this slug already exists' });
            }
        }

        if (Array.isArray(req.body.imageOrder)) {
            const currentIds = project.images.map((image) => imageRecordId(image));
            const order = req.body.imageOrder.map((id) => String(id));
            const sameMembers =
                order.length === currentIds.length
                && new Set(order).size === order.length
                && order.every((id) => currentIds.includes(id));

            if (!sameMembers) {
                return res.status(400).json({
                    status: 400,
                    message: 'imageOrder must list each existing image id once',
                });
            }

            project.images.forEach((image) => {
                image.sort_order = order.indexOf(imageRecordId(image));
            });
        }

        if (fields.slug) project.slug = fields.slug;
        if (fields.title) project.title = fields.title;
        if (fields.description) project.description = fields.description;
        if (fields.original_price !== undefined) project.original_price = fields.original_price;
        if (fields.current_price !== undefined) project.current_price = fields.current_price;
        if (fields.active !== undefined) project.active = fields.active;

        await project.save();

        return res.status(200).json({
            status: 200,
            project: toAdminProject(project),
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ status: 409, message: 'A project with this slug already exists' });
        }
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function uploadAdminShopProjectImages(req, res) {
    const uploaded = [];

    try {
        const slug = normalizeSlug(req.params.slug);
        if (!isValidSlug(slug)) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const project = await ShopProject.findOne({ slug });
        if (!project) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return res.status(400).json({ status: 400, message: 'At least one image is required' });
        }

        if (project.images.length + files.length > MAX_IMAGES) {
            return res.status(400).json({
                status: 400,
                message: `A project can have at most ${MAX_IMAGES} images`,
            });
        }

        let sortOrder = project.images.reduce(
            (max, image) => Math.max(max, image.sort_order ?? 0),
            -1
        );

        for (const file of files) {
            const extension = IMAGE_TYPES[file.mimetype];
            if (!extension) {
                const error = new Error('Only PNG, JPEG, and WebP images are allowed');
                error.statusCode = 400;
                throw error;
            }

            const imageId = crypto.randomUUID();
            const objectKey = buildShopProjectImageKey(slug, imageId, extension);
            const stored = await uploadBytes(file.buffer, objectKey, file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype);
            uploaded.push({
                image_id: imageId,
                storage_path: stored.storage_path,
                s3_uri: stored.s3_uri,
                content_type: file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype,
                original_name: file.originalname || '',
                sort_order: sortOrder + 1,
            });
            sortOrder += 1;
        }

        project.images.push(...uploaded);
        await project.save();

        return res.status(201).json({
            status: 201,
            project: toAdminProject(project),
        });
    } catch (error) {
        if (uploaded.length) {
            await deleteObjectsByLocation(uploaded.map((image) => ({
                s3Uri: image.s3_uri,
                storagePath: image.storage_path,
            }))).catch(() => {});
        }
        return res.status(error.statusCode || 500).json({
            status: error.statusCode || 500,
            message: error.message,
        });
    }
}

async function deleteAdminShopProjectImage(req, res) {
    try {
        const slug = normalizeSlug(req.params.slug);
        const imageId = String(req.params.imageId || '').trim();
        if (!isValidSlug(slug)) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const project = await ShopProject.findOne({ slug });
        if (!project) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const image = project.images.find((item) => imageRecordId(item) === imageId);
        if (!image) {
            return res.status(404).json({ status: 404, message: 'Image not found' });
        }

        await deleteObjectsByLocation([{
            s3Uri: image.s3_uri,
            storagePath: image.storage_path,
        }]).catch((error) => {
            console.error('[shop] Failed to delete project image from S3:', error.message);
        });

        const remaining = project.images
            .filter((item) => imageRecordId(item) !== imageId)
            .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
            .map((item, index) => ({
                image_id: imageRecordId(item),
                storage_path: item.storage_path,
                s3_uri: item.s3_uri,
                content_type: item.content_type,
                original_name: item.original_name || '',
                sort_order: index,
            }));
        project.images.splice(0, project.images.length, ...remaining);
        project.markModified('images');
        await project.save();

        return res.status(200).json({
            status: 200,
            project: toAdminProject(project),
        });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    }
}

async function deleteAdminShopProject(req, res) {
    try {
        const slug = normalizeSlug(req.params.slug);
        if (!isValidSlug(slug)) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const project = await ShopProject.findOne({ slug });
        if (!project) {
            return res.status(404).json({ status: 404, message: 'Project not found' });
        }

        const orderCount = await ProductOrder.countDocuments({ product_slug: project.slug });
        if (orderCount > 0) {
            project.active = false;
            await project.save();
            return res.status(200).json({
                status: 200,
                deactivated: true,
                message: 'Project has orders, so it was deactivated.',
                project: toAdminProject(project),
            });
        }

        if (project.images.length) {
            await deleteObjectsByLocation(project.images.map((image) => ({
                s3Uri: image.s3_uri,
                storagePath: image.storage_path,
            }))).catch((error) => {
                console.error('[shop] Failed to delete project images from S3:', error.message);
            });
        }

        await project.deleteOne();
        return res.status(200).json({
            status: 200,
            deleted: true,
        });
    } catch (error) {
        return res.status(500).json({ status: 500, message: error.message });
    }
}

export {
    IMAGE_TYPES,
    MAX_IMAGES,
    createAdminShopProject,
    deleteAdminShopProject,
    deleteAdminShopProjectImage,
    getActiveShopProduct,
    getPublicShopProject,
    getPublicShopProjectImage,
    listAdminShopProjects,
    listPublicShopProjects,
    updateAdminShopProject,
    uploadAdminShopProjectImages,
};
