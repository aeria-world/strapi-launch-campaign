// @ts-nocheck
'use strict';

/**
 * contest service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::contest.contest', ({ strapi }) => ({
    fetchActiveContest: async () => {
        return strapi.db.query('api::contest.contest').findMany({
            where: {
                isActive: true
            }
        });
    }
}));
