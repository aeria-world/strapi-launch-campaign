// @ts-nocheck
'use strict';

const shuffle = require('lodash/shuffle');

/**
 * prize service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::prize.prize', ({ strapi }) => ({
    allocatePrizes: async contestId => {
        if (!contestId)
            throw new Error('contestId is required!!');

        const contestInfo = await getContestInfo(contestId);
        console.log('contestInfo -> ', contestInfo)
        if (!contestInfo || Object.keys(contestInfo).length === 0)
            throw new Error('Requested contest not found or it might be inactive!!');

        const runningPhase = await strapi.service('api::phase.phase').findRunningPhase(contestInfo.id);
        console.log('runningPhase -> ', runningPhase);
        if (!runningPhase)
            throw new Error('No running phase found for this contest!!');

        // updating resultDeclaration key i.e., "isResultDeclared"
        await strapi.db.query('api::phase.phase').update({
            where: { id: runningPhase.id },
            data: { isResultDeclared: true }
        })

        const prizes = runningPhase?.prizes || [];
        if (!prizes?.length)
            throw new Error('No Prize(s) are available!!')

        const minEnrollmentCount = await getEnrollmentCountForContest(contestInfo.id);
        console.log(`minEnrollmentCount -> -> ${minEnrollmentCount}`);

        const availablePrizes = prizes.filter(prize => {
            const minEnroll = Number(prize?.minEnrollment ?? 0); // default to 0 if undefined
            return minEnrollmentCount >= minEnroll;
        });

        console.log('availablePrizes -> -> ', availablePrizes)

        // fetch all enrollment(s) who are enrolled for the provided ContestId
        const enrollmentData = await getCustomerDataWithoutPrizes(contestInfo.id, runningPhase.endDate);
        console.log('enrollmentData -> -> ', enrollmentData);

        if (!enrollmentData.length) {
            console.log('No customers found without allocated prizes');
            return { message: "No customers found without allocated prizes. All customers have already been allocated prizes.", allocatedCount: 0 };
        }

        // Allocate prizes based on probability
        const winners = await allocatePrizesBasedOnProbability(availablePrizes, enrollmentData);

        console.log('Prize allocation completed:', winners);
        return winners;
    }
}));

// Helper function to fetch contest information
async function getContestInfo(contestId) {
    return await strapi.db.query('api::contest.contest').findOne({
        where: { documentId: contestId, isActive: true, publishedAt: { $ne: null } }
    });
}

// Helper function to fetch customers who have enrolled but don't have prizes allocated yet
async function getCustomerDataWithoutPrizes(contestId, phaseEndDate) {
    const enrollments = await strapi.db.query('api::contest-enrollment.contest-enrollment').findMany({
        where: {
            contests: {
                id: contestId
            },
            enrollmentDate: {
                $lt: phaseEndDate
            },
            prize: null,
            publishedAt: { $ne: null }
        },
        populate: {
            customers: true
        }
    });

    return enrollments;
}

async function getEnrollmentCountForContest(contestId) {
    return await strapi.db.query('api::contest-enrollment.contest-enrollment').count({
        where: {
            contests: {
                id: contestId
            },
            publishedAt: { $ne: null }
        }
    });
}

// Function to allocate prizes based on probability
async function allocatePrizesBasedOnProbability(availablePrizes, enrollments) {
    const winners = [];
    const errors = [];
    const prizeTracker = new Map(); // Track allocated quantities per prize

    // Initialize prize tracker and create weighted prize pool
    const weightedPrizePool = [];

    for (const prize of availablePrizes) {
        // Get current prize data to check allocated quantity
        const currentPrize = await strapi.db.query('api::prize.prize').findOne({
            where: { id: prize.id },
            populate: { product: true }
        });

        if (!currentPrize) {
            console.log(`Prize ${prize.id} not found, skipping...`);
            continue;
        }

        const allocatedQuantity = Number(currentPrize.allocatedQuantity || 0);
        const totalQuantity = Number(currentPrize.totalQuantity || 0);

        // Skip prizes that are fully allocated (allocatedQuantity >= totalQuantity)
        if (allocatedQuantity >= totalQuantity) {
            console.log(`Prize with id ${prize.id} is fully allocated (${allocatedQuantity}/${totalQuantity}), skipping...`);
            continue;
        }

        const availableQuantity = totalQuantity - allocatedQuantity;

        // Initialize tracker for this prize
        prizeTracker.set(prize.id, {
            totalQuantity: totalQuantity,
            allocatedQuantity: allocatedQuantity,
            availableQuantity: availableQuantity,
            newAllocations: 0,
            prizeData: currentPrize
        });

        // Set default probability to 1 if not present or invalid
        let probability = Number(prize?.probability);
        if (!probability || isNaN(probability) || probability < 0 || probability > 100) {
            probability = 1;
            console.log(`Prize ${prize.id} has invalid/missing probability, setting to default: 1`);
        }

        // Calculate weight: lower probability = higher weight (more chances)
        // Weight = (101 - probability) so that:
        // - Probability 1 gets weight 100 (highest chance)
        // - Probability 80 gets weight 21 (lower chance)
        // - Probability 100 gets weight 1 (lowest chance)
        const weight = Math.max(1, 101 - probability);

        // Add prize to weighted pool based on calculated weight
        for (let i = 0; i < weight; i++) {
            weightedPrizePool.push({
                ...prize,
                probability: probability,
                weight: weight,
                product: currentPrize.product
            });
        }

        console.log(`Prize ${prize.id}: probability=${probability}, weight=${weight}, available=${availableQuantity}`);
    }

    if (weightedPrizePool.length === 0) {
        console.log('No prizes available in weighted pool - all prizes may be fully allocated')
        throw new Error('No prizes available in weighted pool - all prizes may be fully allocated');
    }

    // Shuffle the weighted prize pool for randomness
    const shuffledWeightedPool = shuffle(weightedPrizePool);

    console.log(`Weighted prize pool size: ${shuffledWeightedPool.length}`);
    console.log(`Available prizes:`, Array.from(prizeTracker.keys()));

    // Shuffle enrollments for fair distribution
    const shuffledEnrollments = shuffle(enrollments);

    // Allocate prizes to enrollments
    for (const enrollment of shuffledEnrollments) {
        try {
            // Check if this enrollment already has a prize (safety check)
            if (enrollment.prize) {
                continue;
            }

            // If no prizes left in weighted pool, break
            if (shuffledWeightedPool.length === 0) {
                console.log('All prizes exhausted from weighted pool');
                break;
            }

            let selectedPrize = null;
            let attempts = 0;
            const maxAttempts = shuffledWeightedPool.length;

            // Try to find an available prize
            while (!selectedPrize && attempts < maxAttempts) {
                const randomIndex = Math.floor(Math.random() * shuffledWeightedPool.length);
                const candidatePrize = shuffledWeightedPool[randomIndex];

                const tracker = prizeTracker.get(candidatePrize.id);

                if (tracker && tracker.availableQuantity > 0) {
                    selectedPrize = candidatePrize;
                    break;
                } else {
                    // Remove exhausted prize from weighted pool
                    shuffledWeightedPool.splice(randomIndex, 1);
                    console.log(`Prize ${candidatePrize.id} exhausted, removed from pool`);
                }

                attempts++;
            }

            if (!selectedPrize) {
                console.log('No available prizes left');
                break;
            }

            // Allocate the prize to the enrollment
            await strapi.db.query('api::contest-enrollment.contest-enrollment').update({
                where: { id: enrollment.id },
                data: {
                    prize: { id: selectedPrize.id },
                    prizeAllocatedAt: new Date()
                }
            });

            // Update the prize's allocated quantity in database
            const tracker = prizeTracker.get(selectedPrize.id);
            const newAllocatedQuantity = tracker.allocatedQuantity + tracker.newAllocations + 1;

            await strapi.db.query('api::prize.prize').update({
                where: { documentId: selectedPrize.documentId },
                data: {
                    allocatedQuantity: newAllocatedQuantity.toString()
                }
            });

            // Update local tracker
            tracker.allocatedQuantity = newAllocatedQuantity;
            tracker.newAllocations += 1;
            tracker.availableQuantity = tracker.totalQuantity - newAllocatedQuantity;

            // Add winner information to results
            const customers = enrollment.customers || [];
            const randomCustomer = customers.length > 0 ? customers[Math.floor(Math.random() * customers.length)] : null;

            winners.push({
                upin: randomCustomer?.upin,
                deviceId: randomCustomer?.deviceId,
                prize: {
                    id: selectedPrize.id,
                    probability: selectedPrize.probability,
                    weight: selectedPrize.weight,
                    product: selectedPrize.product
                }
            });

            console.log(`Allocated prize ${selectedPrize.id} (prob: ${selectedPrize.probability}, weight: ${selectedPrize.weight}) to customer ${randomCustomer?.upin}. Allocated: ${newAllocatedQuantity}/${tracker.totalQuantity}`);

            // If prize is fully allocated, remove all instances from weighted pool
            if (tracker.availableQuantity <= 0) {
                for (let i = shuffledWeightedPool.length - 1; i >= 0; i--) {
                    if (shuffledWeightedPool[i].id === selectedPrize.id) {
                        shuffledWeightedPool.splice(i, 1);
                    }
                }
                console.log(`Prize ${selectedPrize.id} fully allocated, removed from weighted pool`);
            }

        } catch (error) {
            console.error(`Error allocating prize to enrollment ${enrollment.id}:`, error);
            const customers = enrollment.customers || [];
            const randomCustomer = customers.length > 0 ? customers[Math.floor(Math.random() * customers.length)] : null;

            errors.push({
                enrollmentId: enrollment.id,
                upin: randomCustomer?.upin,
                deviceId: randomCustomer?.deviceId,
                error: error.message
            });
        }
    }

    // Generate allocation summary
    const allocationSummary = {};
    prizeTracker.forEach((tracker, prizeId) => {
        const finalAllocatedQuantity = tracker.allocatedQuantity;
        const availableQuantity = tracker.totalQuantity - finalAllocatedQuantity;

        allocationSummary[prizeId] = {
            prizeName: tracker.prizeData.product?.title || `Prize ${prizeId}`,
            totalQuantity: tracker.totalQuantity,
            allocatedQuantity: finalAllocatedQuantity,
            availableQuantity: availableQuantity,
            newAllocations: tracker.newAllocations,
            fullyAllocated: availableQuantity <= 0
        };
    });

    return {
        winners,
        errors,
        totalProcessed: enrollments.length,
        winnersCount: winners.length,
        allocationSummary,
        prizesFullyAllocated: Object.values(allocationSummary).filter(p => p.fullyAllocated).length
    };
}
