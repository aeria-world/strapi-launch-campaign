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
            ? await allocateGiftWithMaxGifts(contestInfo, customerInfo)
            : await allocateGiftWithProbability(contestInfo, customerInfo);
    }
    // prizeAllocation: async (contestId, userInfo) => {

    //     const runningPhase = await strapi.service('api::phase.phase').findRunningPhase(contestInfo.id);
    //     console.log('runningPhase -> ', runningPhase);
    //     if (!runningPhase)
    //         throw new Error('No running phase found for this contest!!');

    //     const customerInfo = await getOrCreateCustomer(userInfo);
    //     console.log('customerInfo -> ', customerInfo);

    //     return (contestInfo?.maxGifts && Number(contestInfo?.maxGifts) > 0)
    //         ? await allocateGiftWithMaxGifts(contestInfo, prizes, customerInfo, contestInfo.id)
    //         : await allocateGiftWithProbability(prizes, customerInfo, contestInfo.id);
    // },

    // // Get currently running phase for a contest
    // getRunningPhase: async (contestId) => {
    //     if (!contestId) {
    //         throw new Error('contestId is required to find running phase');
    //     }

    //     const runningPhase = await strapi.service('api::phase.phase').findRunningPhase(contestId);

    //     if (!runningPhase) {
    //         throw new Error('No running phase found for this contest');
    //     }

    //     return runningPhase;
    // },

    // // Get all running phases across all contests
    // getAllRunningPhases: async () => {
    //     const runningPhases = await strapi.service('api::phase.phase').findAllRunningPhases();
    //     return runningPhases;
    // },

    // // Get gifts from currently running phase
    // getGiftsFromRunningPhase: async (contestId) => {
    //     const runningPhase = await strapi.service('api::giftallocation.giftallocation').getRunningPhase(contestId);

    //     if (!runningPhase.gifts || runningPhase.gifts.length === 0) {
    //         throw new Error('No gifts available in the currently running phase');
    //     }

    //     return runningPhase.gifts;
    // }
    // prizeAllocation: async (contestId, userInfo) => {
    //     console.log('userInfo from service(s) -> ', userInfo)
    //     if (!contestId)
    //         throw new Error('contestId not found!!');

    //     const existingGift = await checkExistingGift(contestId, userInfo);
    //     if (existingGift) {
    //         return existingGift.gift && Object.keys(existingGift.gift).length ? existingGift.gift : existingGift;
    //     }

    //     const contestInfo = await getContestInfo(contestId);
    //     if (!contestInfo || Object.keys(contestInfo).length === 0)
    //         throw new Error('Requested contest not found or it might be inactive!!');

    //     const customerInfo = await getOrCreateCustomer(userInfo);

    //     // fetch all available gifts
    //     const gifts = await getAvailableGifts(contestInfo.id);
    //     if (!gifts?.length)
    //         throw new Error('No gifts available right now!!')

    //     return contestInfo?.maxGifts && Number(contestInfo?.maxGifts) > 0
    //         ? await allocateGiftWithMaxGifts(contestInfo, gifts, customerInfo, contestId)
    //         : await allocateGiftWithProbability(gifts, customerInfo, contestId);
    // },
    // fetchAllGifts: async (contestName) => {
    //     if (!contestName) {
    //         throw new Error('contestName is required!!');
    //     }

    //     // Find the contest by name
    //     const contest = await strapi.db.query('api::contest.contest').findOne({
    //         where: { name: contestName },
    //     });

    //     if (!contest) {
    //         throw new Error('Contest not found');
    //     }

    //     // Fetch all gifts related to the contest
    //     const gifts = await strapi.db.query('api::gift.gift').findMany({
    //         where: { contest: contest.id },
    //         populate: { image: true }
    //     });

    //     const updatedGifs = gifts.map(function (gift) {
    //         return {
    //             documentId: gift?.documentId || '',
    //             title: gift?.title || '',
    //             description: gift?.description || '',
    //             image: {
    //                 documentId: gift?.image?.documentId || '',
    //                 name: gift?.image?.name || '',
    //                 mime: gift?.image?.mime || '',
    //                 ext: gift?.image?.ext || '',
    //                 url: gift?.image?.url || ''
    //             }
    //         }
    //     })

    //     return updatedGifs;
    // }
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

// async function checkExistingGift(contestId, userInfo) {
//     const [isPrizeAlreadyAllocatedToUser, isPrizeAlreadyAllocatedToDevice] = await Promise.all([
//         strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
//             where: {
//                 contests: { documentId: contestId },
//                 customers: { upin: userInfo.userId },
//                 publishedAt: { $ne: null },
//                 giftAllocatedAt: { $ne: null }
//             },
//             populate: {
//                 gift: {
//                     fields: ['title', 'description', 'worth'],
//                     populate: { image: { fields: ['url', 'name'] } }
//                 }
//             }
//         }),
//         strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
//             where: {
//                 contests: { documentId: contestId },
//                 customers: { deviceId: userInfo.deviceId },
//                 publishedAt: { $ne: null },
//                 giftAllocatedAt: { $ne: null }
//             },
//             populate: {
//                 gift: {
//                     fields: ['title', 'description', 'worth'],
//                     populate: { image: { fields: ['url', 'name'] } }
//                 }
//             }
//         })
//     ]);

//     console.log('isPrizeAlreadyAllocatedToUser -> -> ', isPrizeAlreadyAllocatedToUser);
//     console.log('isPrizeAlreadyAllocatedToDevice -> -> ', isPrizeAlreadyAllocatedToDevice);

//     return isPrizeAlreadyAllocatedToUser || isPrizeAlreadyAllocatedToDevice;
// }

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

// // Helper function to fetch available gifts
// async function getAvailableGifts(contestId) {
//     const gifts = await strapi.db.query('api::gift.gift').findMany({
//         where: { publishedAt: { $ne: null }, contest: { id: contestId } }
//     });
//     console.log('gifts ->', gifts);
//     return gifts;
// }

// Helper function to allocate gift when maxGifts is specified
async function allocateGiftWithMaxGifts(contestInfo, customerInfo) {
    const allocatedGiftsCount = await strapi.db.query('api::contest-enrollment.contest-enrollment').count({
        where: { contests: contestInfo.id, publishedAt: { $ne: null } },
    });
    console.log('allocatedGiftsCount ->', allocatedGiftsCount);

    if (allocatedGiftsCount >= Number(contestInfo?.maxGifts)) {
        throw new Error('All gift(s) has been allocated!!');
    }

    const arrayOfGiftIds = contestInfo.gifts.map(gift => gift.id);
    console.log('arrayOfGiftIds before shuffle ->', arrayOfGiftIds);

    const shuffledArrayOfGiftIds = shuffle(arrayOfGiftIds);
    console.log('shuffledArrayOfGiftIds after shuffle ->', shuffledArrayOfGiftIds);

    const randomIndex = Math.floor(Math.random() * shuffledArrayOfGiftIds.length);
    console.log('randomIndex ->', shuffledArrayOfGiftIds[randomIndex]);

    await strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
        data: {
            contests: { id: contestInfo.id },
            customers: { id: customerInfo.id },
            gift: { id: shuffledArrayOfGiftIds[randomIndex] },
            giftAllocatedAt: new Date(),
            enrollmentDate: new Date(),
            publishedAt: new Date()
        },
    });

    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: shuffledArrayOfGiftIds[randomIndex] },
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

// Helper function to allocate gift based on probability or random selection based on totalQty and remainingQty
async function allocateGiftWithProbability(contestInfo, customerInfo) {
    const availableGifts = contestInfo.gifts.filter(gift => gift.remainingQuantity > 0 || gift.probability > 0);
    if (!availableGifts.length)
        throw new Error('No gifts with remaining quantity or probability available!!');

    const giftsWithCalculatedProbability = availableGifts.map(gift => {
        if (gift.probability > 0) {
            return gift; // Keep original probability
        } else if (gift.totalQuantity > 0 && gift.remainingQuantity > 0) {
            // Calculate probability based on remaining quantity ratio
            const calculatedProbability = Math.round((gift.remainingQuantity / gift.totalQuantity) * 100);
            return {
                ...gift,
                probability: calculatedProbability
            };
        } else {
            // If no probability and no valid quantities, assign a default low probability
            return {
                ...gift,
                probability: 1
            };
        }
    });

    // Check if all gifts have probability values
    const allHaveProbability = giftsWithCalculatedProbability.every(gift => gift.probability > 0);

    let selectedGift;
    if (allHaveProbability) {
        // Calculate total probability
        const totalProbability = availableGifts.reduce((sum, gift) => sum + (gift?.probability || 0), 0);

        // Weighted random selection
        let randomValue = Math.random() * totalProbability;
        selectedGift = availableGifts.find(gift => {
            if (randomValue < (gift.probability || 0)) return true;
            randomValue -= gift.probability || 0;
            return false;
        }) || availableGifts[Math.floor(Math.random() * availableGifts.length)];
    } else {
        // Random selection if any gift lacks probability
        const randomIndex = Math.floor(Math.random() * availableGifts.length);
        selectedGift = availableGifts[randomIndex];
    }

    const promiseArr = [
        strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
            data: {
                contests: { id: contestInfo.id },
                customers: customerInfo.id,
                gift: selectedGift.id,
                giftAllocatedAt: new Date(),
                enrollmentDate: new Date(),
                publishedAt: new Date()
            },
        })
    ];

    // Update remaining quantity if gift has totalQuantity and remainingQuantity
    if (selectedGift.totalQuantity !== undefined && selectedGift.remainingQuantity !== undefined) {
        promiseArr.push(
            strapi.entityService.update('api::gift.gift', selectedGift.id, {
                data: {
                    remainingQuantity: (Number(selectedGift.remainingQuantity) - 1).toString(),
                },
            })
        );
    }

    await Promise.all(promiseArr);

    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: selectedGift.id },
        select: ['documentId', 'title', 'description', 'worth'],
        populate: { image: { select: ['url', 'name'] } }
    });

    return giftWithMedia;
}
