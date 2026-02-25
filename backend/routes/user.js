/**
 * Routes User — /api/user
 */

import { database } from '../services/database.js';

export async function userRoutes(fastify) {
  // GET /api/user/me
  fastify.get('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await database.getUserById(request.user.id);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const subscriptions = await database.getSubscriptionsByUserId(user.id);
    const vms = await database.getVMsByUserId(user.id);

    reply.send({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at
      },
      subscriptions,
      vmCount: vms.length
    });
  });

  // PUT /api/user/profile
  fastify.put('/profile', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { displayName, email, avatarUrl } = request.body || {};
    const updated = await database.updateUser(request.user.id, {
      display_name: displayName,
      email: email || null,
      avatar_url: avatarUrl || null
    });
    reply.send({ success: true, user: updated });
  });
}
