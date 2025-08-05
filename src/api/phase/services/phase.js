// @ts-nocheck
'use strict';

/**
 * phase service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::phase.phase', ({ strapi }) => ({
    findRunningPhase: async (contestId) => {
        if (!contestId)
            throw new Error('contestId is required!!');

        const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

        const currentPhase = await strapi.db.query('api::phase.phase').findOne({
            where: {
                contest: contestId,
                endDate: { $gte: today }
            },
            populate: {
                prizes: {
                    fields: ['totalQuantity', 'allocatedQuantity', 'probability'],
                    populate: {
                        product: {
                            fields: ['title', 'description', 'worth'],
                            populate: { image: { fields: ['url', 'name'] } }
                        }
                    }
                }
            }
        });

        return currentPhase;
    }
}));
