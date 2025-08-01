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

      const data = await strapi.service('api::giftallocation.giftallocation').prizeAllocation(contestId, ctx.state.user);

      ctx.status = 200;
      ctx.body = { status: 'ok', data };
    } catch (err) {
      console.log('error in allocateGift -> ', err)
      console.log('error message', err.message)
      ctx.status = 500;
      ctx.body = { error: err.message || err.toString() };
    }
  },
  // fetchAllGifts: async (ctx, next) => {
  //   try {
  //     const { contestName } = ctx.query;
  //     const gifts = await strapi.service('api::giftallocation.giftallocation').fetchAllGifts(contestName);
  //     ctx.body = gifts;
  //   } catch (error) {
  //     console.log('error in fetchAllGifts -> ', error)
  //     ctx.status = 400;
  //     ctx.body = { error: error.message || error.toString() };
  //   }
  // }
};
