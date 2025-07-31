// @ts-nocheck
const { ValidationError } = require('@strapi/utils').errors;

module.exports = {
    async beforeCreate(event) {
        console.log('beforeCreate triggered with data:', event.params.data);
        await validateGiftQuantities(event.params.data, event);
    },

    async afterCreate(event) {
        await updateProductRemainingQuantityOnGiftCreate(event.params.data);
    },

    async beforeUpdate(event) {
        console.log('beforeUpdate triggered with data:', event.params.data);
        await validateGiftQuantities(event.params.data, event);
    },
};

async function validateGiftQuantities(data, event) {
    try {
        console.log('DEBUG: data.product =', data.product);
        let productId;

        // Case 1: Extract product ID from the request body
        if (typeof data.product === 'number' || typeof data.product === 'string') {
            productId = data.product;
        } else if (
            typeof data.product === 'object' &&
            data.product !== null &&
            Array.isArray(data.product.connect) &&
            data.product.connect.length > 0 &&
            data.product.connect[0].id
        ) {
            productId = data.product.connect[0].id;
        } else if (
            typeof data.product === 'object' &&
            data.product !== null &&
            'id' in data.product
        ) {
            productId = data.product.id;
        }

        // Case 2: If product was not passed (likely during update), fetch existing gift and its product
        if (!productId && event?.params?.where?.id) {
            const giftId = event.params.where.id;
            const existingGift = await strapi.entityService.findOne('api::gift.gift', giftId, {
                populate: { product: { fields: ['id'] } },
            });

            if (existingGift?.product?.id) {
                productId = existingGift.product.id;
            }
        }

        if (!productId) {
            throw new Error('Product relation is missing or invalid.');
        }

        // Fetch product info
        const product = await strapi.entityService.findOne('api::product.product', productId, {
            fields: ['totalQuantity', 'remainingQuantity'],
        });
        console.log('product -> -> ', product)

        if (!product) {
            throw new Error(`Product with ID ${productId} not found.`);
        }

        const giftTotalQty = BigInt(data.totalQuantity || 0);
        console.log('giftTotalQty -> -> ', giftTotalQty);
        const giftRemainingQty = BigInt(data.remainingQuantity || 0);
        console.log('giftRemainingQty -> -> ', giftRemainingQty);
        console.log('BigInt(product.remainingQuantity) -> ', BigInt(product.remainingQuantity))

        if (
            giftTotalQty > BigInt(product.remainingQuantity) ||
            giftRemainingQty > BigInt(product.remainingQuantity)
        ) {
            throw new ValidationError(
                `Gift quantity exceeds product stock.\nProduct total: ${product.totalQuantity}, remaining: ${product.remainingQuantity}`
            );
        }
    } catch (err) {
        console.error('Gift validation error:', err);
        throw new ValidationError(`Gift validation failed: ${err.message}`);
    }
}

async function updateProductRemainingQuantityOnGiftCreate(data) {
    let productId;
    if (typeof data.product === 'number' || typeof data.product === 'string') {
        productId = data.product;
    } else if (
        typeof data.product === 'object' &&
        data.product !== null &&
        Array.isArray(data.product.connect) &&
        data.product.connect.length > 0 &&
        data.product.connect[0].id
    ) {
        productId = data.product.connect[0].id;
    } else if (
        typeof data.product === 'object' &&
        data.product !== null &&
        'id' in data.product
    ) {
        productId = data.product.id;
    }

    if (!productId) return;

    const giftTotalQty = BigInt(data.totalQuantity || 0);

    // Fetch product
    const product = await strapi.entityService.findOne('api::product.product', productId, {
        fields: ['remainingQuantity'],
    });

    if (!product) return;

    const newRemaining = BigInt(product.remainingQuantity) - giftTotalQty;

    await strapi.entityService.update('api::product.product', productId, {
        data: {
            remainingQuantity: newRemaining.toString(),
        },
    });
}

