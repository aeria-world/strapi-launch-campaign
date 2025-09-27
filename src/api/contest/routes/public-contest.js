module.exports = {
    routes: [{
        method: 'GET',
        path: '/public-contests',
        handler: 'api::contest.contest.fetchActiveContest',
        config: {
            auth: false,
            policies: [],
            middlewares: []
        }
    }]
};
