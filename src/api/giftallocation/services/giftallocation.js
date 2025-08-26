'use strict';

const shuffle = require('lodash/shuffle');

/**
 * giftallocation service
 */

class AppError extends Error {
    constructor(message, code, status, data) {
        super(message);
        this.code = code;
        this.status = status;
        this.data = data;
    }
}

// immediate[Enrollment(Contest-Enrollment)] provide gift to the user
// Phase [Prize(s) randomly distributes to all the enrollments]

module.exports = {
    giftAllocation: async (contestId, userInfo) => {
        // console.log('contestId -> ', contestId)
        // console.log('userInfo -> ', userInfo)

        if (!contestId)
            throw new Error('contestId is required!!');

        if (!userInfo.userId || !userInfo.deviceId) {
            if (!userInfo.userId) throw new Error('userId is required!!');
            if (!userInfo.deviceId) throw new Error('deviceId is required!!');
        }

        const contestInfo = await getContestInfo(contestId);
        // console.log('contestInfo -> ', contestInfo);
        if (!contestInfo || Object.keys(contestInfo).length === 0)
            throw new Error('Requested contest not found or it might be inactive!!');

        const gifts = contestInfo?.gifts;
        // console.log('gifts -> ', gifts);

        if (!gifts || gifts.length === 0)
            throw new Error('No gifts available in this contest!!');

        const customerInfo = await getOrCreateCustomer(userInfo);
        // console.log('customerInfo -> ', customerInfo);

        let currentPhase = await strapi.service('api::phase.phase').findRunningPhase(contestInfo.id, customerInfo.createdAt);
        console.log('first currentPhase -> ', currentPhase);

        let prizeInfo = null;
        if (currentPhase?.prizes?.length) {
            const prizes = currentPhase.prizes.filter(Boolean);
            const maxProbability = Math.max(
                ...prizes.map(p => Number(p?.probability || 0))
            );
            prizeInfo = prizes.find(p => Number(p?.probability || 0) === maxProbability) || null;
            console.log('Max probability prize -> ', prizeInfo);
        }

        let phaseInfo = {};
        phaseInfo = {
            endDate: currentPhase?.endDate || '',
            isResultDeclared: currentPhase?.isResultDeclared || false,
            documentId: currentPhase?.documentId || '',
            prizeInfo: {
                documentId: prizeInfo?.documentId || '',
                congratulationHeading: prizeInfo?.congratulationHeading || '',
                product: {
                    documentId: prizeInfo?.product?.documentId || '',
                    title: prizeInfo?.product?.title || '',
                    description: prizeInfo?.product?.description || '',
                    worth: prizeInfo?.product?.worth || '',
                    image: prizeInfo?.product?.image?.length ? prizeInfo.product?.image.map(img => ({
                        documentId: img?.documentId || '',
                        name: img?.name || '',
                        url: img?.url || ''
                    })) : []
                }
            }
        };

        // Check if the user already won in the provided contest
        const existingGift = await checkExistingGift(contestId, userInfo);
        console.log('existingGift -> ', existingGift);

        if (existingGift && Object.keys(existingGift).length) {
            return {
                ...existingGift,
                customerInfo: {
                    upin: customerInfo?.upin || '',
                    deviceId: customerInfo?.deviceId || '',
                    name: customerInfo?.name || '',
                    companyName: customerInfo?.companyName || ''
                },
                phase: await getPhaseInfoForResponse(contestInfo, existingGift, phaseInfo)
            };
        }

        const response = (contestInfo?.maxGifts && Number(contestInfo?.maxGifts) > 0)
            ? await allocatedGiftsWithProbMaxGifts(contestInfo, customerInfo, await getPhaseInfoForResponse(contestInfo, null, phaseInfo))
            : await allocatedGiftsWithQuantity(contestInfo, customerInfo, await getPhaseInfoForResponse(contestInfo, null, phaseInfo));

        return {
            ...response,
            customerInfo: {
                upin: customerInfo?.upin || '',
                deviceId: customerInfo?.deviceId || '',
                name: customerInfo?.name || '',
                companyName: customerInfo?.companyName || ''
            },
            phase: await getPhaseInfoForResponse(contestInfo, null, phaseInfo)
        }
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
            select: ['documentId', 'giftAllocatedAt', 'giftClaimedAt', 'prizeAllocatedAt', 'enrollmentDate', 'redemptionCode'],
            populate: {
                gift: {
                    select: ['documentId', 'congratulationHeading'],
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
                },
                prize: {
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
            select: ['documentId', 'giftAllocatedAt', 'giftClaimedAt', 'prizeAllocatedAt', 'enrollmentDate', 'redemptionCode'],
            populate: {
                gift: {
                    select: ['documentId', 'probability', 'congratulationHeading'],
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
                },
                prize: {
                    select: ['documentId', 'probability'],
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
                }
            }
        })
    ]);

    console.log('isPrizeAlreadyAllocatedToUser -> -> ', isPrizeAlreadyAllocatedToUser);
    console.log('isPrizeAlreadyAllocatedToDevice -> -> ', isPrizeAlreadyAllocatedToDevice);

    return isPrizeAlreadyAllocatedToUser || isPrizeAlreadyAllocatedToDevice;
}

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
                companyName: userInfo?.companyName || '',
                publishedAt: new Date(),
                createdBy: { id: 1 },
                updatedBy: { id: 1 }
            }
        });
    }

    return customerInfo;
}

// Helper function to allocate gift with probability with maxGifts
async function allocatedGiftsWithProbMaxGifts(contestInfo, customerInfo, phaseForError) {
    // 1. Check if maxGifts limit is reached
    const allocatedGiftsCount = await strapi.db.query('api::contest-enrollment.contest-enrollment').count({
        where: { contests: contestInfo.id, publishedAt: { $ne: null } },
    });
    console.log('allocatedGiftsCount ->', allocatedGiftsCount);

    if (allocatedGiftsCount >= Number(contestInfo?.maxGifts))
        throw new AppError('All gift(s) has been allocated!!', 'MAX_GIFTS_REACHED', 409, { phase: phaseForError, customerInfo });

    // Get gifts with their current data including allocatedQuantity
    const availableGifts = await strapi.db.query('api::gift.gift').findMany({
        where: {
            contest: { id: contestInfo.id },
            publishedAt: { $ne: null }
        },
        select: ['id', 'probability', 'allocatedQuantity', 'totalQuantity', 'congratulationHeading']
    });

    if (availableGifts.length === 0)
        // throw new Error('No gifts available for allocation!');
        throw new AppError('All gift(s) has been allocated!!', 'MAX_GIFTS_REACHED', 409, { phase: phaseForError, customerInfo });

    // 2. Set default probability if not available
    const giftsWithProbability = availableGifts.map(gift => ({
        ...gift,
        probability: gift?.probability || 1
    }));

    console.log('giftsWithProbability ->', giftsWithProbability);

    // 3. Allocate gift based on inverse probability (lower probability = higher chance)
    const selectedGift = selectGiftByProbability(giftsWithProbability);
    console.log('selectedGift ->', selectedGift);

    // Generate unique redemption code
    const uniqueRedemptionCode = await generateUniqueAlphaNumericCode();

    const promiseArr = [
        // Create contest enrollment
        strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
            data: {
                contests: { id: contestInfo.id },
                customers: { id: customerInfo.id },
                gift: { id: selectedGift.id },
                giftAllocatedAt: new Date(),
                redemptionCode: uniqueRedemptionCode,
                enrollmentDate: new Date(),
                publishedAt: new Date()
            },
        }),

        // Update allocated quantity for the selected gift
        strapi.db.query('api::gift.gift').updateMany({
            where: { id: selectedGift.id },
            data: {
                allocatedQuantity: (Number(selectedGift?.allocatedQuantity || 0) + 1).toString()
            }
        })
    ]

    await Promise.all(promiseArr);

    // Fetch gift details with media for return
    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: selectedGift.id },
        select: ['documentId', 'congratulationHeading'],
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

    return {
        ...giftWithMedia,
        redemptionCode: uniqueRedemptionCode
    };
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
async function allocatedGiftsWithQuantity(contestInfo, customerInfo, phaseForError) {
    // 1. Filter gifts with totalQuantity > 0
    const availableGifts = contestInfo.gifts.filter(gift => gift.totalQuantity > 0);

    if (!availableGifts.length)
        // throw new Error('No gifts available!!');
        throw new AppError('All gift(s) has been allocated!!', 'MAX_GIFTS_REACHED', 409, { phase: phaseForError, customerInfo });

    console.log('Available gifts with remaining quantity:', availableGifts);

    // 2. Make a random choice for picking up the gift
    const randomIndex = Math.floor(Math.random() * availableGifts.length);
    const selectedGift = availableGifts[randomIndex];

    console.log('Selected gift:', selectedGift);

    // Generate unique redemption code
    const uniqueRedemptionCode = await generateUniqueAlphaNumericCode();

    // Create contest enrollment and update allocated quantity in parallel
    const promiseArr = [
        // Create contest enrollment
        strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
            data: {
                contests: { id: contestInfo.id },
                customers: customerInfo.id,
                gift: selectedGift.id,
                giftAllocatedAt: new Date(),
                redemptionCode: uniqueRedemptionCode,
                enrollmentDate: new Date(),
                publishedAt: new Date()
            },
        }),

        // 3. Subtract 1 from allocatedQuantity
        strapi.db.query('api::gift.gift').updateMany({
            where: { id: selectedGift.id },
            data: {
                allocatedQuantity: (Number(selectedGift?.allocatedQuantity || 0) + 1).toString()
            }
        })
    ];

    await Promise.all(promiseArr);

    // Fetch gift details with media for return
    const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
        where: { id: selectedGift.id },
        select: ['documentId', 'congratulationHeading'],
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

    console.log('Gift allocated with media:', giftWithMedia);
    delete giftWithMedia.id;
    delete giftWithMedia.product.id;

    return {
        ...giftWithMedia,
        redemptionCode: uniqueRedemptionCode
    };
}

async function generateUniqueAlphaNumericCode(maxAttempts = 10) {
    let attempts = 0;

    while (attempts < maxAttempts) {
        const code = generateAlphaNumericCode();

        // Check if code already exists in the database
        const existingEnrollment = await strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
            where: { redemptionCode: code }
        });

        if (!existingEnrollment) {
            console.log(`Unique redemption code generated: ${code} (attempts: ${attempts + 1})`);
            return code;
        }

        attempts++;
        console.log(`Redemption code ${code} already exists, retrying... (attempt ${attempts})`);
    }

    // If we couldn't generate a unique code after maxAttempts, throw an error
    throw new Error(`Failed to generate unique redemption code after ${maxAttempts} attempts`);
}

function generateAlphaNumericCode() {
    const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';

    const allChars = upperCase + digits;

    let code = '';
    code += upperCase.charAt(Math.floor(Math.random() * upperCase.length));
    code += digits.charAt(Math.floor(Math.random() * digits.length));

    // Fill remaining 4 chars randomly
    for (let i = 0; i < 4; i++) {
        code += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle to avoid predictable placement
    code = code.split('').sort(() => Math.random() - 0.5).join('');

    return code;
}

// Function to get appropriate phase information for response
async function getPhaseInfoForResponse(contestInfo, existingGift, defaultPhaseInfo) {
    // If customer won a prize, return the won phase info
    if (existingGift?.prize && Object.keys(existingGift.prize)?.length) {
        const wonPhaseInfo = await getWonPhaseInfo(contestInfo, existingGift, defaultPhaseInfo);
        if (wonPhaseInfo) {
            return wonPhaseInfo;
        }
    }

    // Return default phase info (current running phase)
    return defaultPhaseInfo;
}


async function getWonPhaseInfo(contestInfo, existingGift, defaultPhaseInfo) {
    try {
        // Fetch the phase information for the won prize
        const wonPhase = await strapi.db.query('api::phase.phase').findOne({
            where: {
                contest: { id: contestInfo.id },
                prizes: { id: existingGift.prize.id }
            },
            select: ['documentId', 'endDate', 'isResultDeclared'],
            populate: {
                prizes: {
                    where: { id: existingGift.prize.id },
                    select: ['documentId'],
                    populate: {
                        product: {
                            select: ['documentId', 'title', 'description', 'worth'],
                            populate: {
                                image: {
                                    select: ['name', 'url']
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!wonPhase) {
            console.log('No phase found for the won prize');
            return null;
        }

        const wonPrize = wonPhase.prizes?.[0];

        return {
            endDate: wonPhase.endDate || '',
            isResultDeclared: wonPhase.isResultDeclared || false,
            documentId: wonPhase.documentId || '',
            prizeInfo: {
                documentId: wonPrize?.documentId || '',
                congratulationHeading: wonPrize?.congratulationHeading || '',
                product: {
                    documentId: wonPrize?.product?.documentId || '',
                    title: wonPrize?.product?.title || '',
                    description: wonPrize?.product?.description || '',
                    worth: wonPrize?.product?.worth || '',
                    image: wonPrize?.product?.image?.length ? wonPrize.product.image.map(img => ({
                        documentId: img?.documentId || '',
                        name: img?.name || '',
                        url: img?.url || ''
                    })) : []
                }
            }
        };
    } catch (error) {
        console.error('Error fetching won phase info:', error);
        return defaultPhaseInfo;
    }
}
