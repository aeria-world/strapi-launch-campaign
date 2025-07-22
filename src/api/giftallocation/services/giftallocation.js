'use strict';

/**
 * giftallocation service
 */

module.exports = {
    fetchAllGifts: async (contestName) => {
        if (!contestName) {
            throw new Error('contestName is required!!');
        }

        // Find the contest by name
        const contest = await strapi.db.query('api::contest.contest').findOne({
            where: { name: contestName },
        });

        if (!contest) {
            throw new Error('Contest not found');
        }

        // Fetch all gifts related to the contest
        const gifts = await strapi.db.query('api::gift.gift').findMany({
            where: { contest: contest.id },
            populate: { image: true }
        });

        const updatedGifs = gifts.map(function (gift) {
            return {
                documentId: gift?.documentId || '',
                title: gift?.title || '',
                description: gift?.description || '',
                image: {
                    documentId: gift?.image?.documentId || '',
                    name: gift?.image?.name || '',
                    mime: gift?.image?.mime || '',
                    ext: gift?.image?.ext || '',
                    url: gift?.image?.url || ''
                }
            }
        })

        return updatedGifs;
    }
};
