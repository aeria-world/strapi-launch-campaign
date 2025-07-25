'use strict';

/**
 * contest service
 */

// @ts-ignore
const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::contest.contest');
