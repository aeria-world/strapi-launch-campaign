'use strict';

/**
 * A set of functions called "actions" for `giftallocation`
 */

module.exports = {
  allocateGift: async (ctx, next) => {
    try {
      const { token, contest } = ctx.query;
      if (!token)
        return ctx.unauthorized('Invalid credentials');

      const contestInfo = await strapi.db.query('api::contest.contest').findOne({
        where: { name: contest, isActive: true },
      });

      // This block will catch both null and undefined, and also if contestInfo is an empty object
      if (!contestInfo || Object.keys(contestInfo).length === 0) {
        ctx.status = 400;
        ctx.body = { error: 'Provided contest not found!!' };
        return;
      }

      const gifts = await strapi.db.query('api::gift.gift').findMany({
        where: { contest: contestInfo.id, isActive: true },
      });

      ctx.body = 'ok';
    } catch (err) {
      console.log('error in allocateGift -> ', err)
      ctx.body = err;
    }
  },
  fetchAllGifts: async (ctx, next) => {
    try {
      const { contestName } = ctx.query;
      const gifts = await strapi.service('api::giftallocation.giftallocation').fetchAllGifts(contestName);
      ctx.body = gifts;
    } catch (error) {
      console.log('error in fetchAllGifts -> ', error)
      ctx.status = 400;
      ctx.body = { error: error.message || error.toString() };
    }
  }
};
