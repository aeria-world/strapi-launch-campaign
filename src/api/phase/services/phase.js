'use strict';

/**
 * phase service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::phase.phase');
