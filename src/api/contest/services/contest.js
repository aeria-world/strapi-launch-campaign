// @ts-nocheck
'use strict';

/**
 * contest service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::contest.contest', ({ strapi }) => ({
    fetchActiveContest: async () => {
        let data = await strapi.db.query('api::contest.contest').findMany({
            where: {
                isActive: true
            }
        });

        return data.map(contest => {
            return {
                id: contest.documentId,
                name: contest.name
            }
        })
    }
}));
