'use strict';

/**
 * contest-enrollment controller
 */

module.exports = {
    contestEnrollmentController: async (ctx, next) => {
        try {
            const { token, contest } = ctx.body;
            await strapi.service('api::contest-enrollment.contest-enrollment').contestEnrollmentService(ctx, token, contest);
            ctx.body = { message: "You've successfully enrolled for the contest!!" }
        } catch (error) {
            console.error(`error -> -> `, error);
            ctx.status = error.status || 500;
            ctx.body = {
                error: {
                    message: error.message || 'An unexpected error occurred.',
                }
            };
        }
    }
};
