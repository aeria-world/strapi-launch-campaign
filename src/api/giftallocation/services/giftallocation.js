'use strict';

const shuffle = require('lodash/shuffle');

/**
 * giftallocation service
 */

module.exports = {
    prizeAllocation: async (contestId, userInfo) => {
        console.log('userInfo from service(s) -> ', userInfo)
        if (!contestId)
            throw new Error('contestId not found!!');

        const [isPrizeAlreadyAllocatedToUser, isPrizeAlreadyAllocatedToDevice] = await Promise.all([
            strapi.db.query('api::customer.customer').findOne({
                where: { upin: userInfo.userId }
            }),
            strapi.db.query('api::customer.customer').findOne({
                where: { deviceId: userInfo.deviceId }
            })
        ]);

        console.log('isPrizeAlreadyAllocatedToUser -> -> ', isPrizeAlreadyAllocatedToUser);
        if ((isPrizeAlreadyAllocatedToUser && Object.keys(isPrizeAlreadyAllocatedToUser).length) || (isPrizeAlreadyAllocatedToDevice && Object.keys(isPrizeAlreadyAllocatedToDevice).length)) {
            let condition = {};
            if (isPrizeAlreadyAllocatedToUser && Object.keys(isPrizeAlreadyAllocatedToUser).length) {
                condition = {
                    upin: userInfo.userId
                }
            } else if (isPrizeAlreadyAllocatedToDevice && Object.keys(isPrizeAlreadyAllocatedToDevice).length) {
                condition = {
                    deviceId: userInfo.deviceId
                }
            }
            const customerInfo = await strapi.db.query('api::customer.customer').findOne({
                where: {
                    ...condition,
                    publishedAt: { $ne: null }
                }
            })
            console.log('customerInfo -> ', customerInfo);
            if (!customerInfo)
                throw new Error('Invalid url')

            const giftWithMedia = await strapi.db.query('api::contest-enrollment.contest-enrollment').findOne({
                where: {
                    customers: { id: customerInfo.id },
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
            console.log('giftWithMedia -> ', giftWithMedia);
            if (giftWithMedia?.gift && Object.keys(giftWithMedia?.gift).length) {
                return giftWithMedia.gift;
            }
            return giftWithMedia;
        }

        console.log('isPrizeAlreadyAllocatedToDevice -> -> ', isPrizeAlreadyAllocatedToDevice);

        const contestInfo = await strapi.db.query('api::contest.contest').findOne({
            where: {
                documentId: contestId,
                isActive: true
            }
        });
        console.log('contestInfo -> ', contestInfo)
        if (!contestInfo || Object.keys(contestInfo).length === 0)
            throw new Error('Requested contest not found or it might be inactive!!');

        let customerInfo = await strapi.db.query('api::customer.customer').findOne({
            where: {
                upin: userInfo.userId
            }
        });
        console.log('customerInfo -> ', customerInfo)
        // if customer doesn't exist in DB then saving their information
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
            console.log('customerInfo -> -> ', customerInfo)
        }

        // fetch all available gifts
        const gifts = await strapi.db.query('api::gift.gift').findMany({
            where: { publishedAt: { $ne: null } }
        });
        console.log('gifts -> ', gifts)
        if (!gifts?.length)
            throw new Error('No gifts available right now!!')

        // if I've maxGifts available in contest then I'll take the probability mode
        if (contestInfo?.maxGifts && Number(contestInfo?.maxGifts) > 0) {
            console.log('inside if condt')
            const allocatedGiftsCount = await strapi.db.query('api::contest-enrollment.contest-enrollment').count({
                where: {
                    contests: contestInfo.id,
                    publishedAt: { $ne: null },
                },
            });
            console.log('allocatedGiftsCount -> -> ', allocatedGiftsCount);

            if (allocatedGiftsCount < Number(contestInfo?.maxGifts)) {
                const arrayOfGiftIds = gifts.map(gift => gift.id);
                console.log('arrayOfGiftIds before shuffle -> ', arrayOfGiftIds);

                const shuffledArrayOfGiftIds = shuffle(arrayOfGiftIds);
                console.log('shuffledArrayOfGiftIds after shuffle -> ', shuffledArrayOfGiftIds);

                const randomIndex = Math.floor(Math.random() * shuffledArrayOfGiftIds.length);
                console.log('randomIndex -> -> ', shuffledArrayOfGiftIds[randomIndex]);

                await strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
                    data: {
                        contests: contestId,
                        customers: customerInfo.id,
                        gift: shuffledArrayOfGiftIds[randomIndex],
                        giftAllocatedAt: new Date(),
                        enrollmentDate: new Date(),
                        publishedAt: new Date()
                    },
                })

                const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
                    where: { id: shuffledArrayOfGiftIds[randomIndex] },
                    select: ['documentId', 'title', 'description', 'worth'],
                    populate: { image: { select: ['url', 'name'] } }
                });
                console.log('giftWithMedia -> -> ', giftWithMedia)

                return giftWithMedia;
            } else {
                throw new Error('All gift(s) has been allocated!!');
            }
        } else {
            console.log('inside else block')
            const availableGifts = gifts.filter(gift => gift.remainingQuantity > 0);
            if (!availableGifts.length) {
                throw new Error('No gifts with remaining quantity available!!');
            }

            // Calculate total probability
            const totalProbability = availableGifts.reduce((sum, gift) => sum + (gift?.probability || 0), 0);
            if (totalProbability <= 0) {
                // If no valid probabilities, select randomly
                const randomIndex = Math.floor(Math.random() * availableGifts.length);
                const selectedGift = availableGifts[randomIndex];

                const promiseArr = [];

                // Create contest enrollment
                promiseArr.push(
                    strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
                        data: {
                            contests: contestId,
                            customers: customerInfo.id,
                            gift: selectedGift.id,
                            giftAllocatedAt: new Date(),
                            enrollmentDate: new Date(),
                            publishedAt: new Date()
                        },
                    })
                )

                // Update remaining quantity
                promiseArr.push(
                    strapi.entityService.update('api::gift.gift', selectedGift.id, {
                        data: {
                            remainingQuantity: selectedGift.remainingQuantity - 1,
                        },
                    })
                )

                await Promise.all(promiseArr);

                const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
                    where: { id: selectedGift.id },
                    select: ['documentId', 'title', 'description', 'worth'],
                    populate: { image: { select: ['url', 'name'] } }
                });

                return giftWithMedia;
            }

            // Weighted random selection based on probability
            let randomValue = Math.random() * totalProbability;
            let selectedGift = null;
            for (const gift of availableGifts) {
                if (randomValue < (gift.probability || 0)) {
                    selectedGift = gift;
                    break;
                }
                randomValue -= gift.probability || 0;
            }

            // Fallback to random selection if no gift is selected (due to rounding errors)
            if (!selectedGift) {
                const randomIndex = Math.floor(Math.random() * availableGifts.length);
                selectedGift = availableGifts[randomIndex];
            }

            const promiseArr = [];

            // Create contest enrollment
            promiseArr.push(
                strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
                    data: {
                        contests: contestId,
                        customers: customerInfo.id,
                        gift: selectedGift.id,
                        giftAllocatedAt: new Date(),
                        enrollmentDate: new Date(),
                        publishedAt: new Date()
                    },
                })
            );

            // Update remaining quantity
            promiseArr.push(
                strapi.entityService.update('api::gift.gift', selectedGift.id, {
                    data: {
                        remainingQuantity: selectedGift.remainingQuantity - 1,
                    },
                })
            )

            await Promise.all(promiseArr);

            const giftWithMedia = await strapi.db.query('api::gift.gift').findOne({
                where: { id: selectedGift.id },
                select: ['documentId', 'title', 'description', 'worth'],
                populate: { image: { select: ['url', 'name'] } }
            });

            return giftWithMedia;
        }
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
