'use strict';

/**
 * A set of functions called "actions" for `giftallocation`
 */

module.exports = {
  allocateGift: async (ctx, next) => {
    try {
      const { contestId } = ctx.request.body;
      if (!contestId)
        throw new Error('Contest ID is required!!');

      const data = await strapi.service('api::giftallocation.giftallocation').giftAllocation(contestId, ctx.state.user);

      ctx.status = 200;
      ctx.body = { status: 'ok', data };
    } catch (err) {
      console.log('error in allocateGift -> ', err)
      console.log('error message', err.message)
      ctx.status = err.status || 500;
      ctx.body = {
        error: err.message || err.toString(),
        code: err.code || 'INTERNAL_ERROR',
        phase: err?.data?.phase,
        customerInfo: err?.data?.customerInfo
      };
    }
  }
};
