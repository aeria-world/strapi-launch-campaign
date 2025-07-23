// 'use strict';

// /**
//  * contest-enrollment router
//  */

// // @ts-ignore
// const { createCoreRouter } = require('@strapi/strapi').factories;

// module.exports = createCoreRouter('api::contest-enrollment.contest-enrollment');

module.exports = {
    routes: [{
        method: 'POST',
        path: '/contest-enrollment',
        handler: 'contest-enrollment.contestEnrollmentController',
        config: {
            auth: false,
            policies: [],
            middlewares: []
        }
    }]
};
