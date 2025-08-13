// @ts-nocheck
'use strict';

/**
 * phase controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::phase.phase', ({ strapi }) => ({
    async fetchCurrentPhase(ctx) {
        try {
            const { contestId } = ctx.request.body;

            if (!contestId)
                return ctx.badRequest('ConstestId missing!!');

            const customerInfo = await getCustomerInfo(ctx.state.user);
            console.log('customerInfo -> -> ', customerInfo);

            const currentPhaseInfo = await strapi.service('api::phase.phase').findRunningPhase(contestId, customerInfo.createdAt);
            console.log('currentPhaseInfo -> ', currentPhaseInfo)

            return ctx.send({
                status: 'ok',
                data: currentPhaseInfo
            });
        } catch (error) {
            console.error('Unable to fetch the current Phase: ', error);
            return ctx.internalServerError('Unable to fetch the current Phase!!');
        }
    }
}));

// Helper function to fetch or create customer
async function getCustomerInfo(userInfo) {
    return await strapi.db.query('api::customer.customer').findOne({
        where: { upin: userInfo.userId }
    });
};
