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

            // Debug environment variable
            console.log('JWT_PUBLIC_KEY exists:', !!process.env.JWT_PUBLIC_KEY);
            console.log('JWT_PUBLIC_KEY type:', typeof process.env.JWT_PUBLIC_KEY);
            console.log('JWT_PUBLIC_KEY length:', process.env.JWT_PUBLIC_KEY?.length);
            console.log('JWT_PUBLIC_KEY first 50 chars:', process.env.JWT_PUBLIC_KEY?.substring(0, 50));
            console.log('JWT_PUBLIC_KEY includes BEGIN:', process.env.JWT_PUBLIC_KEY?.includes('-----BEGIN'));
            console.log('JWT_PUBLIC_KEY includes END:', process.env.JWT_PUBLIC_KEY?.includes('-----END'));

            let decoded;
            let publicKey = process.env.JWT_PUBLIC_KEY;

            // Handle different algorithms
            if (header?.alg === 'RS256' || header?.alg === 'RS512') {
                if (!publicKey) {
                    console.error('JWT_PUBLIC_KEY is not set');
                    return ctx.unauthorized('Server configuration error');
                }

                // Handle escaped newlines in environment variable
                publicKey = publicKey.replace(/\\n/g, '\n');

                console.log('Processed public key first 50 chars:', publicKey.substring(0, 50));
                console.log('Processed public key includes proper headers:',
                    publicKey.includes('-----BEGIN PUBLIC KEY-----') &&
                    publicKey.includes('-----END PUBLIC KEY-----'));

                // Asymmetric algorithm - use public key
                decoded = jwt.verify(token, publicKey, {
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
                if (error.message.includes('asymmetric key')) {
                    return ctx.unauthorized('Invalid public key format');
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
