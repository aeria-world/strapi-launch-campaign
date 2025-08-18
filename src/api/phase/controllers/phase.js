// @ts-nocheck
'use strict';

/**
 * phase controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::phase.phase', ({ strapi }) => ({
    async fetchCurrentPhase(ctx) {
        try {
            const { contestId } = ctx.request.body;

            if (!contestId)
                return ctx.badRequest('ConstestId missing!!');

            const customerInfo = await getCustomerInfo(ctx.state.user);
            if (!customerInfo)
                return ctx.badRequest('Invalid token!!');

            const contestInfo = await getContestInfo(contestId);
            if (!contestInfo)
                return ctx.badRequest('Invalid contest!!');

            const currentPhaseInfo = await strapi.service('api::phase.phase').findRunningPhase(contestInfo.id, customerInfo.createdAt);

            // Filter out prizes where product.isBetterLuck is true
            const filteredPrizes = (currentPhaseInfo?.prizes || []).filter(function (prize) {
                return !(prize?.product?.isBetterLuck === true);
            });

            let prizeInfo = null;
            if (filteredPrizes?.length) {
                const prizes = filteredPrizes.filter(Boolean);
                const maxProbability = Math.max(
                    ...prizes.map(p => Number(p?.probability || 0))
                );
                prizeInfo = prizes.find(p => Number(p?.probability || 0) === maxProbability) || null;
            }

            let data = {
                documentId: currentPhaseInfo?.documentId || '',
                endDate: currentPhaseInfo?.endDate || '',
                isResultDeclared: currentPhaseInfo?.isResultDeclared || false,
                prizes: filteredPrizes?.length ? filteredPrizes.map(function (prize) {
                    return {
                        documentId: prize?.documentId || '',
                        probability: prize?.probability || 1,
                        product: {
                            documentId: prize?.product?.documentId || '',
                            title: prize?.product?.title || '',
                            worth: prize?.product?.worth || '',
                            description: prize?.product?.description || '',
                            image: prize?.product?.image?.length ? prize.product.image.map(function (image) {
                                return {
                                    documentId: image?.documentId || '',
                                    url: image?.url || ''
                                }
                            }) : []
                        }
                    }
                }) : [],
                customerInfo: {
                    upin: customerInfo?.upin || '',
                    deviceId: customerInfo?.deviceId || '',
                    name: customerInfo?.name || 'N/A'
                },
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
            }

            const enrollmentGift = await checkExistingGift(contestId, ctx.state.user);
            console.log('enrollmentGift -> ', JSON.stringify(enrollmentGift))
            if (enrollmentGift && Object.keys(enrollmentGift).length) {
                data['enrollmentGift'] = {
                    giftClaimedAt: enrollmentGift?.giftClaimedAt || '',
                    redemptionCode: enrollmentGift?.redemptionCode || '',
                    gift: {
                        documentId: enrollmentGift?.gift?.documentId || '',
                        product: {
                            title: enrollmentGift?.gift?.product?.title || 'N/A',
                            image: enrollmentGift?.gift?.product?.image?.length ? enrollmentGift?.gift?.product?.image.map(function (image) {
                                return {
                                    url: image?.url || ''
                                }
                            }) : [],
                            worth: enrollmentGift?.gift?.product?.worth || '',
                            description: enrollmentGift?.gift?.product?.description || ''
                        }
                    },
                    prize: {
                        documentId: enrollmentGift?.prize?.documentId || '',
                        product: {
                            title: enrollmentGift?.prize?.product?.title || 'N/A',
                            isBetterLuck: enrollmentGift?.prize?.product?.isBetterLuck || false,
                            image: enrollmentGift?.prize?.product?.image?.length ? enrollmentGift?.prize?.product?.image.map(function (image) {
                                return {
                                    url: image?.url || ''
                                }
                            }) : [],
                            worth: enrollmentGift?.gift?.product?.worth || '',
                            description: enrollmentGift?.gift?.product?.description || ''
                        }
                    }
                }
            }

            return ctx.send({ status: 'ok', data });
        } catch (error) {
            console.error('Unable to fetch the current Phase: ', error);
            return ctx.internalServerError('Unable to fetch the current Phase!!');
        }
    }
}));

// Helper function to fetch or create customer
async function getCustomerInfo(userInfo) {
    return await strapi.db.query('api::customer.customer').findOne({
        where: { upin: userInfo.userId }
    });
};

async function getContestInfo(contestId) {
    return await strapi.db.query('api::contest.contest').findOne({
        where: { documentId: contestId }
    });
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
                            select: ['documentId', 'title', 'description', 'worth', 'isBetterLuck'],
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
                            select: ['documentId', 'title', 'description', 'worth', 'isBetterLuck'],
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
