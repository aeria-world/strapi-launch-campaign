'use strict';

/**
 * giftallocation service
 */

module.exports = {
    prizeAllocation: async (contestId, userInfo) => {
        console.log('userInfo from service(s) -> ', userInfo)
        if (!contestId)
            throw new Error('contestId not found!!');

        const isPrizeAlreadyAllocatedToUser = await strapi.db.query('api::customer.customer').findOne({
            where: {
                upin: userInfo.userId
            }
        })
        console.log('isPrizeAlreadyAllocatedToUser -> -> ', isPrizeAlreadyAllocatedToUser)
        if (isPrizeAlreadyAllocatedToUser && Object.keys(isPrizeAlreadyAllocatedToUser).length)
            throw new Error(`You've already participate in this competition!!`);

        const isPrizeAlreadyAllocatedToDevice = await strapi.db.query('api::customer.customer').findOne({
            where: {
                deviceId: userInfo.deviceId
            }
        });
        console.log('isPrizeAlreadyAllocatedToDevice -> -> ', isPrizeAlreadyAllocatedToDevice)
        if (isPrizeAlreadyAllocatedToDevice && Object.keys(isPrizeAlreadyAllocatedToDevice).length)
            throw new Error('This device has been already participate in this competition!!');

        const contestInfo = await strapi.db.query('api::contest.contest').findOne({
            where: {
                documentId: contestId,
                isActive: true
            }
        });
        console.log('contestInfo -> ', contestInfo)
        if (!contestInfo || Object.keys(contestInfo).length === 0)
            throw new Error('No contest found!!');

        const isCustomerExist = await strapi.db.query('api::customer.customer').findOne({
            where: {
                upin: userInfo.userId
            }
        });
        console.log('isCustomerExist -> ', isCustomerExist)
        if (isCustomerExist)
            throw new Error("You've already registerd!!")

        const customerInfo = await strapi.entityService.create('api::customer.customer', {
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

        const enrollment = await strapi.db.query('api::contest-enrollment.contest-enrollment').create({
            data: {
                customer: customerInfo.id,
                contest: contestInfo.id,
                publishedAt: new Date()
            }
        });
        console.log('enrollment -> ', enrollment)

        const prizes = await strapi.db.query('api::prize.prize').findMany({
            where: {
                contest: {
                    id: contestInfo.id,
                },
                isActive: true
            },
        });
        console.log(`${prizes.length} prizes found!!`, prizes);
        const filteredPrizes = prizes.filter(prize => Number(prize.remainingQuantity) > 0);
        console.log(`${filteredPrizes.length} number of prizes found available!!`);

        if (!filteredPrizes?.length)
            throw new Error('No prize(s) has been attached with this contest!!');

        const arrayOfPrizeIds = filteredPrizes.map(obj => obj.id);
        console.log(`arrayOfPrizeIds before shuffle -> -> ${arrayOfPrizeIds}`)

        const shuffledArrayOfPrizeIds = shuffle(arrayOfPrizeIds);
        console.log(`arrayOfPrizeIds after shuffle -> -> ${shuffledArrayOfPrizeIds}`)

        const randomIndex = Math.floor(Math.random() * shuffledArrayOfPrizeIds.length);
        console.log('randomIndex -> -> ', shuffledArrayOfPrizeIds[randomIndex]);

        const prizeWithMedia = await strapi.db.query('api::prize.prize').findOne({
            where: { id: shuffledArrayOfPrizeIds[randomIndex] },
            select: ['documentId', 'name', 'description', 'worth', 'remainingQuantity'],
            populate: { image: { select: ['url', 'name'] } }
        });
        console.log('prizeWithMedia -> -> ', prizeWithMedia)

        const promiseArr = [];
        const currentQty = Number(prizeWithMedia.remainingQuantity);
        console.log(`currentQty -> -> ${currentQty}`);

        // updating the quantity of prize
        promiseArr.push(
            strapi.db.query('api::prize.prize').updateMany({
                where: { name: prizeWithMedia.name },
                data: {
                    remainingQuantity: (currentQty - 1).toString(),
                },
            })
        );

        // inserting the 
        promiseArr.push(
            strapi.entityService.create('api::contest-enrollment.contest-enrollment', {
                data: {
                    contests: [contestInfo.id],
                    customer: customerInfo.id,
                    prize: prizeWithMedia.id,
                    prizeAllocatedAt: new Date(),
                    publishedAt: new Date()
                }
            })
        );

        const promiseResponse = await Promise.all(promiseArr);
        console.log('promiseResponse -> -> ', promiseResponse)
        delete prizeWithMedia.remainingQuantity;
        delete prizeWithMedia.id

        return prizeWithMedia;
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
