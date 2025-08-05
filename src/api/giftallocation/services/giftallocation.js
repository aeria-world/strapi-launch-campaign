'use strict';

const shuffle = require('lodash/shuffle');

/**
 * giftallocation service
 */

// immediate[Enrollment(Contest-Enrollment)] provide gift to the user
// Phase [Prize(s) randomly distributes to all the enrollments]

module.exports = {
    giftAllocation: async (contestId, userInfo) => {
        console.log('contestId -> ', contestId)
        console.log('userInfo -> ', userInfo)

        if (!contestId)
            throw new Error('contestId is required!!');

        if (!userInfo.userId || !userInfo.deviceId) {
            if (!userInfo.userId) throw new Error('userId is required!!');
            if (!userInfo.deviceId) throw new Error('deviceId is required!!');
        }

        const contestInfo = await getContestInfo(contestId);
        console.log('contestInfo -> ', contestInfo)
        if (!contestInfo || Object.keys(contestInfo).length === 0)
            throw new Error('Requested contest not found or it might be inactive!!');

        const gifts = contestInfo?.gifts;
        console.log('gifts -> ', gifts)

        if (!gifts || gifts.length === 0)
            throw new Error('No gifts available in this contest!!');

        // checking whether the user already win in the provided contest
        const existingGift = await checkExistingGift(contestId, userInfo);
        console.log('existingGift -> -> ', existingGift);
        if (existingGift) {
            return existingGift.gift && Object.keys(existingGift.gift).length ? existingGift.gift : existingGift;
        }

        const customerInfo = await getOrCreateCustomer(userInfo);
        console.log('customerInfo -> ', customerInfo);

        return (contestInfo?.maxGifts && Number(contestInfo?.maxGifts) > 0)
            ? await allocatedGiftsWithProbMaxGifts(contestInfo, customerInfo)
            : await allocatedGiftsWithQuantity(contestInfo, customerInfo);
    }
};

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
                    populate: {
                        product: {
                            fields: ['title', 'description', 'worth'],
                            populate: { image: { fields: ['url', 'name'] } }
                        }
                    }
                }
            }
        }),
        strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
            where: {
                contests: { documentId: contestId },
                customers: { deviceId: userInfo.deviceId },
                publishedAt: { $ne: null },
                giftAllocatedAt: { $ne: null }
            },
            populate: {
                gift: {
                    populate: {
                        product: {
                            fields: ['title', 'description', 'worth'],
                            populate: { image: { fields: ['url', 'name'] } }
                        }
                    }
                }
            }
        })
    ]);

    console.log('isPrizeAlreadyAllocatedToUser -> -> ', isPrizeAlreadyAllocatedToUser);
    console.log('isPrizeAlreadyAllocatedToDevice -> -> ', isPrizeAlreadyAllocatedToDevice);

    return isPrizeAlreadyAllocatedToUser || isPrizeAlreadyAllocatedToDevice;
}

// Helper function to fetch contest information
async function getContestInfo(contestId) {
    return await strapi.db.query('api::contest.contest').findOne({
        where: { documentId: contestId, isActive: true, publishedAt: { $ne: null } },
        populate: {
            gifts: {
                product: {
                    fields: ['title', 'description', 'worth'],
                    populate: { image: { fields: ['url', 'name'] } }
                }
            }
        }
    });
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
    }

    return customerInfo;
}

// Helper function to allocate gift with probability with maxGifts
async function allocatedGiftsWithProbMaxGifts(contestInfo, customerInfo) {
    // 1. Check if maxGifts limit is reached
    const allocatedGiftsCount = await strapi.db.query('api::contest-enrollment.contest-enrollment').count({
        where: { contests: contestInfo.id, publishedAt: { $ne: null } },
    });
    console.log('allocatedGiftsCount ->', allocatedGiftsCount);

    if (allocatedGiftsCount >= Number(contestInfo?.maxGifts)) {
        throw new Error('All gift(s) has been allocated!!');
    }

    // Get gifts with their current data including allocatedQuantity
    const availableGifts = await strapi.db.query('api::gift.gift').findMany({
        where: {
            contest: { id: contestInfo.id },
            publishedAt: { $ne: null }
        },
        select: ['id', 'probability', 'allocatedQuantity', 'totalQuantity']
    });

    if (availableGifts.length === 0)
        throw new Error('No gifts available for allocation!');

    // 2. Set default probability if not available
    const giftsWithProbability = availableGifts.map(gift => ({
        ...gift,
        probability: gift?.probability || 1
    }));

    console.log('giftsWithProbability ->', giftsWithProbability);

    // 3. Allocate gift based on inverse probability (lower probability = higher chance)
    const selectedGift = selectGiftByProbability(giftsWithProbability);
    console.log('selectedGift ->', selectedGift);

    // Create contest enrollment
    await strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
        data: {
            contests: { id: contestInfo.id },
            customers: { id: customerInfo.id },
            gift: { id: selectedGift.id },
            giftAllocatedAt: new Date(),
            enrollmentDate: new Date(),
            publishedAt: new Date()
        },
    });

    // Update allocated quantity for the selected gift
    await strapi.entityService.update('api::gift.gift', selectedGift.id, {
        data: {
            allocatedQuantity: (Number(selectedGift.allocatedQuantity) + 1).toString()
        }
    });

    // Fetch gift details with media for return
    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: selectedGift.id },
        select: ['documentId'],
        populate: {
            product: {
                select: ['documentId', 'title', 'description', 'worth'],
                populate: {
                    image: {
                        select: ['url', 'name']
                    }
                }
            }
        }
    });

    console.log('giftWithMedia ->', giftWithMedia);
    delete giftWithMedia.id;
    delete giftWithMedia.product.id;

    return giftWithMedia;
}

function selectGiftByProbability(gifts) {
    // Calculate inverse weights (100 - probability) so lower probability gets higher weight
    const weightsMap = gifts.map(gift => ({
        gift,
        weight: Math.max(1, 101 - gift.probability) // Ensure minimum weight of 1
    }));

    console.log('weightsMap ->', weightsMap);

    // Calculate total weight
    const totalWeight = weightsMap.reduce((sum, item) => sum + item.weight, 0);

    // Generate random number between 0 and totalWeight
    const randomValue = Math.random() * totalWeight;
    console.log('randomValue ->', randomValue, 'totalWeight ->', totalWeight);

    // Select gift based on weighted random selection
    let currentWeight = 0;
    for (const item of weightsMap) {
        currentWeight += item.weight;
        if (randomValue <= currentWeight) {
            return item.gift;
        }
    }

    // Fallback (should never reach here)
    return weightsMap[weightsMap.length - 1].gift;
}

// Helper function to allocate gift based on random selection based on totalQty and allocatedQty
async function allocatedGiftsWithQuantity(contestInfo, customerInfo) {
    // 1. Filter gifts with totalQuantity > 0
    const availableGifts = contestInfo.gifts.filter(gift => gift.totalQuantity > 0);

    if (!availableGifts.length)
        throw new Error('No gifts available!!');

    console.log('Available gifts with remaining quantity:', availableGifts);

    // 2. Make a random choice for picking up the gift
    const randomIndex = Math.floor(Math.random() * availableGifts.length);
    const selectedGift = availableGifts[randomIndex];

    console.log('Selected gift:', selectedGift);

    // Create contest enrollment and update allocated quantity in parallel
    const promiseArr = [
        // Create contest enrollment
        strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
            data: {
                contests: { id: contestInfo.id },
                customers: customerInfo.id,
                gift: selectedGift.id,
                giftAllocatedAt: new Date(),
                enrollmentDate: new Date(),
                publishedAt: new Date()
            },
        }),

        // 3. Subtract 1 from allocatedQuantity
        strapi.entityService.update('api::gift.gift', selectedGift.id, {
            data: {
                allocatedQuantity: (Number(selectedGift.allocatedQuantity) + 1).toString()
            },
        })
    ];

    await Promise.all(promiseArr);

    // Fetch gift details with media for return
    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: selectedGift.id },
        select: ['documentId', 'title', 'description', 'worth'],
        populate: { image: { select: ['url', 'name'] } }
    });

    console.log('Gift allocated with media:', giftWithMedia);

    return giftWithMedia;
}
