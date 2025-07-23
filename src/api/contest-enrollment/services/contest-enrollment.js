'use strict';

/**
 * contest-enrollment service
 */


module.exports = {
    contestEnrollmentService: async (ctx, token, contest) => {
        const missingFields = [];
        if (!token) missingFields.push('token');
        if (!contest) missingFields.push('contest');
        if (missingFields.length > 0) {
            let message = `Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`;
            throw new Error(message);
        }

        const contestInfo = await strapi.query('api::contest.contest').findOne({
            where: { id: contest, isActive: true },
        });
        if (!contestInfo) {
            throw new Error(`Unable to enroll for the contest!! As contest not available or currently in-active!!`);
        }

        const existingEnrollment = await strapi.query('api::contest-enrollment.contest-enrollment').findOne({
            where: {
                contest: contest,
            },
        });

        if (existingEnrollment) {
            throw new Error(`User is already enrolled in the contest with ID ${contest}`);
        }
    }
}
