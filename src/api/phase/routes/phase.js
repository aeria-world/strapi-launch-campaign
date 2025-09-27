// @ts-nocheck
'use strict';

/**
 * phase router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::phase.phase');

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
        path: '/contest-phase',
        handler: 'api::phase.phase.fetchCurrentPhase',
        config: {
            auth: false,
            policies: [],
            middlewares: ['api::phase.jwt-auth']
        }
    }
];

module.exports = customRouter(defaultRouter, myExtraRoutes);
