'use strict';

/**
 * gift-allocation service
 */

// @ts-ignore
const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::gift-allocation.gift-allocation');
