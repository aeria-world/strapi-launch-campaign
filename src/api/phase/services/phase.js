// @ts-nocheck
'use strict';

/**
 * phase service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::phase.phase', ({ strapi }) => ({
    findRunningPhase: async (contestId, customerJoiningDate = '') => {
        if (!contestId)
            throw new Error('contestId is required!!');

        let phaseEndDate = ''
        if (customerJoiningDate) {
            phaseEndDate = new Date(customerJoiningDate).toISOString().split('T')[0];
        } else {
            phaseEndDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format as DEFAULT
        }
        console.log('phaseEndDate -> -> -> ', phaseEndDate);

        const currentPhase = await strapi.db.query('api::phase.phase').findOne({
            where: {
                contest: contestId,
                isResultDeclared: false,
                endDate: { $gte: phaseEndDate }
            },
            populate: {
                prizes: {
                    fields: ['totalQuantity', 'allocatedQuantity', 'probability'],
                    populate: {
                        product: {
                            fields: ['title', 'description', 'worth', 'isBetterLuck'],
                            populate: { image: { fields: ['url', 'name'] } }
                        }
                    }
                },
                bannerImage: {
                    select: ['url', 'name']
                }
            },
            orderBy: { endDate: 'asc' }
        });

        return currentPhase;
    }
}));
