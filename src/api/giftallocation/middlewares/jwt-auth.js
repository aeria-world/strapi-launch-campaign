// @ts-nocheck
'use strict';

const jwt = require('jsonwebtoken');

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        try {
            const token = ctx?.request?.body?.token;

            if (!token) {
                return ctx.unauthorized('No token provided');
            }

            // Debug: Check token algorithm
            const header = jwt.decode(token, { complete: true })?.header;
            console.log('Token algorithm:', header?.alg);

            let decoded;

            // Handle different algorithms
            if (header?.alg === 'RS256' || header?.alg === 'RS512') {
                // Asymmetric algorithm - use public key
                decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY, {
                    algorithms: [header.alg]
                });
            } else if (header?.alg === 'HS256' || header?.alg === 'HS512') {
                // Symmetric algorithm - use secret
                decoded = jwt.verify(token, process.env.JWT_SECRET, {
                    algorithms: [header.alg]
                });
            } else {
                return ctx.unauthorized('Unsupported token algorithm');
            }

            console.log('decoded -> -> ', decoded);

            if (!decoded?.userId || !decoded?.deviceId) {
                return ctx.unauthorized('Invalid token payload');
            }

            ctx.state.user = decoded;
            await next();

        } catch (error) {
            console.log(`error in token -> -> `, error);

            if (error.name === 'JsonWebTokenError') {
                if (error.message.includes('invalid algorithm')) {
                    return ctx.unauthorized('Token algorithm not supported');
                }
                return ctx.unauthorized('Invalid token format');
            } else if (error.name === 'TokenExpiredError') {
                return ctx.unauthorized('Token expired');
            }

            strapi.log.error('JWT middleware error:', error);
            return ctx.unauthorized('Authentication failed');
        }
    };
};
