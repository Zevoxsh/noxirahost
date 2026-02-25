/**
 * Décorateurs Fastify d'authentification
 * Identiques à NebulaProxyV3 — authenticate + requireAdmin
 */

import { redisService } from '../services/redis.js';

export function registerAuthDecorators(fastify) {
  // ─── authenticate ──────────────────────────────────────
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      let token;
      const authHeader = request.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
        request.user = fastify.jwt.verify(token);
      } else {
        // Extraire depuis le cookie httpOnly
        const cookieHeader = request.headers.cookie || '';
        const match = cookieHeader.split(';')
          .map(p => p.trim())
          .find(p => p.startsWith('token='));

        if (match) {
          token = decodeURIComponent(match.slice('token='.length));
          request.user = fastify.jwt.verify(token);
        } else {
          await request.jwtVerify();
          token = request.cookies?.token;
        }
      }

      // Vérifier blacklist JWT
      if (token && redisService.isConnected) {
        const isBlacklisted = await redisService.isTokenBlacklisted(token);
        if (isBlacklisted) {
          return reply.code(401).send({ error: 'Unauthorized', message: 'Token has been revoked' });
        }
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  });

  // ─── requireAdmin ──────────────────────────────────────
  fastify.decorate('requireAdmin', async function (request, reply) {
    await fastify.authenticate(request, reply);
    if (!request.user) return;
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
  });
}
