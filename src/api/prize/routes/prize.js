// @ts-nocheck
'use strict';

/**
 * prize router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::prize.prize');

const customRouter = (innerRouter, extraRoutes = []) => {
    let routes;
    return {
        get prefix() {
            return innerRouter.prefix;
        },
        get routes() {
            if (!routes) routes = innerRouter.routes.concat(extraRoutes);
            return routes;
        },
    };
};

const myExtraRoutes = [
    {
        method: 'POST',
        path: '/prizeallocation/allocate',
        handler: 'api::prize.prize.allocatePrize',
        config: {
            auth: false,
            policies: [],
            middlewares: [],
        },
    }
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
