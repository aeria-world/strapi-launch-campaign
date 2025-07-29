'use strict';

const shuffle = require('lodash/shuffle');

/**
 * giftallocation service
 */
module.exports = {
    prizeAllocation: async (contestId, userInfo) => {
        // Validate contestId
        if (!contestId) {
            throw new Error('contestId not found!!');
        }

        // Fetch and validate contest
        const contestInfo = await getContestInfo(contestId);
        if (!contestInfo || Object.keys(contestInfo).length === 0) {
            throw new Error('Requested contest not found or it might be inactive!!');
        }

        // Check if user or device has already won a gift
        const existingGift = await checkExistingGift(contestId, userInfo);
        if (existingGift) {
            return existingGift.gift && Object.keys(existingGift.gift).length ? existingGift.gift : existingGift;
        }

        // Fetch or create customer
        const customerInfo = await getOrCreateCustomer(userInfo);

        // Fetch available gifts
        const gifts = await getAvailableGifts(contestInfo.id);
        if (!gifts?.length) {
            throw new Error('No gifts available right now!!');
        }

        // Allocate gift based on contest type
        return contestInfo?.maxGifts && Number(contestInfo?.maxGifts) > 0
            ? await allocateGiftWithMaxGifts(contestInfo, gifts, customerInfo, contestId)
            : await allocateGiftWithProbability(gifts, customerInfo, contestId);
    },

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

        return gifts.map(gift => ({
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
        }));
    }
};

// Helper function to check if user or device has already won a gift
async function checkExistingGift(contestId, userInfo) {
    const [isPrizeAlreadyAllocatedToUser, isPrizeAlreadyAllocatedToDevice] = await Promise.all([
        strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
            where: {
                contests: { documentId: contestId },
                customers: { upin: userInfo.userId },
                publishedAt: { $ne: null },
                giftAllocatedAt: { $ne: null }
            },
            populate: {
                gift: {
                    fields: ['title', 'description', 'worth'],
                    populate: { image: { fields: ['url', 'name'] } }
                }
            }
        }),
        strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
            where: {
                contestants: { documentId: contestId },
                customers: { deviceId: userInfo.deviceId },
                publishedAt: { $ne: null },
                giftAllocatedAt: { $ne: null }
            },
            populate: {
                gift: {
                    fields: ['title', 'description', 'worth'],
                    populate: { image: { fields: ['url', 'name'] } }
                }
            }
        })
    ]);

    console.log('isPrizeAlreadyAllocatedToUser ->', isPrizeAlreadyAllocatedToUser);
    console.log('isPrizeAlreadyAllocatedToDevice ->', isPrizeAlreadyAllocatedToDevice);

    return isPrizeAlreadyAllocatedToUser || isPrizeAlreadyAllocatedToDevice;
}

// Helper function to fetch contest information
async function getContestInfo(contestId) {
    const contestInfo = await strapi.db.query('api::contest.contest').findOne({
        where: { documentId: contestId, isActive: true, publishedAt: { $ne: null } }
    });
    console.log('contestInfo ->', contestInfo);
    return contestInfo;
}

// Helper function to fetch or create customer
async function getOrCreateCustomer(userInfo) {
    let customerInfo = await strapi.db.query('api::customer.customer').findOne({
        where: { upin: userInfo.userId }
    });

    if (!customerInfo) {
        customerInfo = await strapi.entityService.create('api::customer.customer', {
            data: {
                upin: userInfo.userId,
                deviceId: userInfo.deviceId,
                name: userInfo?.name || '',
                publishedAt: new Date(),
                createdBy: { id: 1 },
                updatedBy: { id: 1 }
            }
        });
        console.log('customerInfo ->', customerInfo);
    }
    return customerInfo;
}

// Helper function to fetch available gifts
async function getAvailableGifts(contestId) {
    const gifts = await strapi.db.query('api::gift.gift').findMany({
        where: { publishedAt: { $ne: null }, contest: { id: contestId } }
    });
    console.log('gifts ->', gifts);
    return gifts;
}

// Helper function to allocate gift when maxGifts is specified
async function allocateGiftWithMaxGifts(contestInfo, gifts, customerInfo, contestId) {
    const allocatedGiftsCount = await strapi.db.query('api::contest-enrollment.contest-enrollment').count({
        where: { contests: contestInfo.id, publishedAt: { $ne: null } },
    });
    console.log('allocatedGiftsCount ->', allocatedGiftsCount);

    if (allocatedGiftsCount >= Number(contestInfo?.maxGifts)) {
        throw new Error('All gift(s) has been allocated!!');
    }

    const arrayOfGiftIds = gifts.map(gift => gift.id);
    console.log('arrayOfGiftIds before shuffle ->', arrayOfGiftIds);

    const shuffledArrayOfGiftIds = shuffle(arrayOfGiftIds);
    console.log('shuffledArrayOfGiftIds after shuffle ->', shuffledArrayOfGiftIds);

    const randomIndex = Math.floor(Math.random() * shuffledArrayOfGiftIds.length);
    console.log('randomIndex ->', shuffledArrayOfGiftIds[randomIndex]);

    await strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
        data: {
            contests: contestId,
            customers: customerInfo.id,
            gift: shuffledArrayOfGiftIds[randomIndex],
            giftAllocatedAt: new Date(),
            enrollmentDate: new Date(),
            publishedAt: new Date()
        },
    });

    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: shuffledArrayOfGiftIds[randomIndex] },
        select: ['documentId', 'title', 'description', 'worth'],
        populate: { image: { select: ['url', 'name'] } }
    });
    console.log('giftWithMedia ->', giftWithMedia);

    return giftWithMedia;
}

// Helper function to allocate gift based on probability
async function allocateGiftWithProbability(gifts, customerInfo, contestId) {
    const availableGifts = gifts.filter(gift => gift.remainingQuantity > 0);
    if (!availableGifts.length) {
        throw new Error('No gifts with remaining quantity available!!');
    }

    // Calculate total probability
    const totalProbability = availableGifts.reduce((sum, gift) => sum + (gift?.probability || 0), 0);

    let selectedGift;
    if (totalProbability <= 0) {
        // Random selection if no valid probabilities
        const randomIndex = Math.floor(Math.random() * availableGifts.length);
        selectedGift = availableGifts[randomIndex];
    } else {
        // Weighted random selection
        let randomValue = Math.random() * totalProbability;
        selectedGift = availableGifts.find(gift => {
            if (randomValue < (gift.probability || 0)) return true;
            randomValue -= gift.probability || 0;
            return false;
        }) || availableGifts[Math.floor(Math.random() * availableGifts.length)];
    }

    const promiseArr = [
        strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
            data: {
                contests: contestId,
                customers: customerInfo.id,
                gift: selectedGift.id,
                giftAllocatedAt: new Date(),
                enrollmentDate: new Date(),
                publishedAt: new Date()
            },
        }),
        strapi.entityService.update('api::gift.gift', selectedGift.id, {
            data: {
                remainingQuantity: selectedGift.remainingQuantity - 1,
            },
        })
    ];

    await Promise.all(promiseArr);

    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: selectedGift.id },
        select: ['documentId', 'title', 'description', 'worth'],
        populate: { image: { select: ['url', 'name'] } }
    });

    return giftWithMedia;
}
