'use strict';

/**
 * contest controller
 */

// @ts-ignore
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::contest.contest', ({ strapi }) => ({
    async fetchActiveContest(ctx) {
        try {
            const data = await strapi.service('api::contest.contest').fetchActiveContest();

            return ctx.send({
                data,
                message: 'Contests fetched successfully'
            });
        } catch (error) {
            console.error('Unable to fetch active Contest: ', error);
            return ctx.internalServerError('Unable to fetch the contest!!');
        }
    }
}));
