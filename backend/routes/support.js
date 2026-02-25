/**
 * Routes Support — /api/support
 */

import { database } from '../services/database.js';

export async function supportRoutes(fastify) {
  // GET /api/support/tickets
  fastify.get('/tickets', { preHandler: fastify.authenticate }, async (request, reply) => {
    const tickets = await database.getTicketsByUserId(request.user.id);
    reply.send({ tickets });
  });

  // POST /api/support/tickets
  fastify.post('/tickets', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { subject, message, priority, vmId } = request.body || {};
    if (!subject || !message) return reply.code(400).send({ error: 'subject and message are required' });

    const ticket = await database.createTicket({
      userId: request.user.id,
      vmId: vmId ? parseInt(vmId) : null,
      subject,
      priority: priority || 'low'
    });

    await database.addTicketMessage(ticket.id, request.user.id, message, false);
    reply.code(201).send({ ticket });
  });

  // GET /api/support/tickets/:id
  fastify.get('/tickets/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const ticket = await database.getTicketById(parseInt(request.params.id));
    if (!ticket || ticket.user_id !== request.user.id) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    const messages = await database.getTicketMessages(ticket.id);
    reply.send({ ticket, messages });
  });

  // POST /api/support/tickets/:id/messages — répondre
  fastify.post('/tickets/:id/messages', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { message } = request.body || {};
    if (!message) return reply.code(400).send({ error: 'message is required' });

    const ticket = await database.getTicketById(parseInt(request.params.id));
    if (!ticket || ticket.user_id !== request.user.id) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return reply.code(400).send({ error: 'Ticket is closed' });
    }

    const msg = await database.addTicketMessage(ticket.id, request.user.id, message, false);
    reply.code(201).send({ message: msg });
  });

  // PUT /api/support/tickets/:id/close
  fastify.put('/tickets/:id/close', { preHandler: fastify.authenticate }, async (request, reply) => {
    const ticket = await database.getTicketById(parseInt(request.params.id));
    if (!ticket || ticket.user_id !== request.user.id) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    const updated = await database.closeTicket(ticket.id);
    reply.send({ ticket: updated });
  });
}
