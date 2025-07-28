// @ts-nocheck
'use strict';

/**
 * JWT Authentication Middleware for gift-allocation
 */

const jwt = require('jsonwebtoken');

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
        try {
            const token = ctx?.request?.body?.token;

            if (!token)
                return ctx.unauthorized('No token provided');

            const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY);
            console.log('decoded -> -> ', decoded)

            if (!decoded?.userId || !decoded?.deviceId)
                return ctx.unauthorized('Invalid token payload');

            ctx.state.user = decoded;

            await next();
        } catch (error) {
            console.log(`error in token -> -> `, error)
            if (error.name === 'JsonWebTokenError') {
                return ctx.unauthorized('Invalid token');
            } else if (error.name === 'TokenExpiredError') {
                return ctx.unauthorized('Token expired');
            }

            strapi.log.error('JWT middleware error:', error);
            return ctx.unauthorized('Authentication failed');
        }
    };
};
