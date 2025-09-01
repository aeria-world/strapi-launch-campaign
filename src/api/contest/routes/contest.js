// @ts-nocheck
'use strict';

/**
 * contest router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::contest.contest');


const myExtraRoutes = [{
    method: 'GET',
    path: '/contests',
    handler: 'api::contest.contest.fetchActiveContest',
    config: {
        auth: false,
        policies: []
    }
}];

const customRouter = (innerRouter, extraRoutes =  []) => {
    let routes;
    return {
        get prefix() {
            return innerRouter.prefix;
        },
        get routes() {
            if (!routes) routes = innerRouter.routes.concat(extraRoutes);
            return routes;
        }
    }
};

module.exports = customRouter(defaultRouter, myExtraRoutes);

