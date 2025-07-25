'use strict';

/**
 * A set of functions called "actions" for `giftallocation`
 */

module.exports = {
  allocateGift: async (ctx, next) => {
    try {
      const { token, contestId } = ctx.request.body;
      if (!token || !contestId)
        throw new Error('Invalid url');

      const response = await strapi.service('api::giftallocation.giftallocation').prizeAllocation(contestId, ctx.state.user);

      ctx.status = 200;
      ctx.body = { status: 'ok', data: response };
    } catch (err) {
      console.log('error in allocateGift -> ', err)
      ctx.body = { error: err.message || err.toString() };
    }
  },
  fetchAllGifts: async (ctx, next) => {
    try {
      const { contestName } = ctx.query;
      const gifts = await strapi.service('api::giftallocation.giftallocation').fetchAllGifts(contestName);
      ctx.body = gifts;
    } catch (error) {
      console.log('error in fetchAllGifts -> ', error)
      ctx.body = { error: error.message || error.toString() };
    }
  }
};
