module.exports = {
    '0 0 * * *': async () => {
        // Run daily at midnight to mark expired gift allocations
        const expiredAllocations = await strapi.entityService.findMany('api::gift-allocation.gift-allocation', {
            filters: {
                status: 'allocated',
                expiresAt: {
                    $lt: new Date()
                }
            }
        });

        for (const allocation of expiredAllocations) {
            await strapi.entityService.update('api::gift-allocation.gift-allocation', allocation.id, {
                data: {
                    status: 'expired'
                }
            });
        }

        console.log(`Marked ${expiredAllocations.length} gift allocations as expired`);
    },
};