// @ts-nocheck
'use strict';

/**
 * prize controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::prize.prize', ({ strapi }) => ({
    async allocatePrize(ctx) {
        try {
            const { contestId } = ctx.request.body;

            if (!contestId)
                return ctx.badRequest('Missing contestId');

            const prizeData = await strapi.service('api::prize.prize').allocatePrizes(contestId);

            return ctx.send({
                status: 'ok',
                data: {
                    message: 'Prize allocated successfully',
                    prizeData
                }
            });
        } catch (error) {
            console.error('Prize allocation failed:', error);
            return ctx.internalServerError('Something went wrong');
        }
    }
}));
