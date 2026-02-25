/**
 * Routes Auth — /api/auth
 * Basé sur NebulaProxyV3 auth.js — auth locale JWT + scrypt
 */

import crypto from 'crypto';
import { database } from '../services/database.js';
import { redisService } from '../services/redis.js';
import { pool } from '../config/database.js';
import { config } from '../config/config.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const dummy = 'scrypt$0000000000000000$' + '0'.repeat(128);
  const hashToVerify = stored || dummy;
  try {
    const parts = hashToVerify.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      crypto.scryptSync(password, '0000000000000000', 64);
      return false;
    }
    const [, salt, hashHex] = parts;
    const hash = Buffer.from(hashHex, 'hex');
    const derived = crypto.scryptSync(password, salt, hash.length);
    const isValid = crypto.timingSafeEqual(hash, derived);
    return stored && isValid;
  } catch {
    return false;
  }
}

function sendAuthSuccess(request, reply, dbUser) {
  const token = request.server.jwt.sign(
    {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      displayName: dbUser.display_name,
      email: dbUser.email,
      avatarUrl: dbUser.avatar_url || null
    },
    { expiresIn: config.jwtExpiry }
  );

  const isSecure = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';

  reply
    .setCookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production' && isSecure,
      sameSite: config.nodeEnv === 'production' && isSecure ? 'strict' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    })
    .send({
      success: true,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        displayName: dbUser.display_name,
        email: dbUser.email,
        role: dbUser.role,
        avatarUrl: dbUser.avatar_url || null
      }
    });
}

export async function authRoutes(fastify) {
  // GET /api/auth/mode
  fastify.get('/mode', async (request, reply) => {
    let registrationEnabled = true;
    try {
      const { rows } = await pool.query("SELECT value FROM system_config WHERE key = 'registration_enabled'");
      registrationEnabled = rows.length > 0 ? rows[0].value === 'true' : true;
    } catch { /* ignore */ }

    reply.send({ registrationEnabled, authType: 'local' });
  });

  // POST /api/auth/login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 255 },
          password: { type: 'string', minLength: 1, maxLength: 1024 }
        },
        additionalProperties: false
      }
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { username, password } = request.body;

    const dbUser = await database.getUserByUsername(username);
    if (!dbUser || !dbUser.password_hash) {
      return reply.code(401).send({ success: false, error: 'Authentication failed', message: 'Invalid credentials' });
    }

    if (dbUser.is_active === false || dbUser.is_suspended) {
      return reply.code(403).send({ success: false, error: 'Account disabled', message: 'Your account is disabled or suspended' });
    }

    const isValid = verifyPassword(password, dbUser.password_hash);
    if (!isValid) {
      return reply.code(401).send({ success: false, error: 'Authentication failed', message: 'Invalid credentials' });
    }

    await database.updateUserLoginTime(dbUser.id);
    sendAuthSuccess(request, reply, dbUser);
    fastify.log.info({ username: dbUser.username, role: dbUser.role }, 'User logged in');
  });

  // POST /api/auth/register
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50, pattern: '^[a-zA-Z0-9._-]+$' },
          displayName: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: 'string', maxLength: 255 },
          password: { type: 'string', minLength: 8, maxLength: 1024 }
        },
        additionalProperties: false
      }
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    // Vérifier si l'inscription est activée
    try {
      const { rows } = await pool.query("SELECT value FROM system_config WHERE key = 'registration_enabled'");
      const enabled = rows.length > 0 ? rows[0].value === 'true' : true;
      if (!enabled) {
        return reply.code(403).send({ success: false, error: 'Registration disabled', message: 'Public registration is currently disabled' });
      }
    } catch { /* continue */ }

    const { username, password, displayName, email } = request.body;

    const existing = await database.getUserByUsername(username);
    if (existing) {
      return reply.code(409).send({ success: false, error: 'User already exists', message: 'Username is already taken' });
    }

    try {
      const passwordHash = hashPassword(password);
      const dbUser = await database.createUser({
        username,
        displayName: displayName || username,
        email: email || null,
        role: 'user',
        passwordHash
      });
      sendAuthSuccess(request, reply, dbUser);
      fastify.log.info({ username: dbUser.username }, 'User registered');
    } catch (error) {
      fastify.log.error({ error }, 'Registration failed');
      reply.code(500).send({ success: false, error: 'Registration failed', message: 'Unable to register user' });
    }
  });

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: fastify.authenticate }, async (request, reply) => {
    try {
      const token = request.cookies?.token || request.headers.authorization?.slice(7);
      if (token && redisService.isConnected) {
        const decoded = fastify.jwt.decode(token);
        if (decoded?.exp) await redisService.blacklistToken(token, decoded.exp);
      }
    } catch { /* ignore */ }

    reply.clearCookie('token', { path: '/' }).send({ success: true, message: 'Logged out successfully' });
  });

  // GET /api/auth/verify
  fastify.get('/verify', { preHandler: fastify.authenticate }, async (request, reply) => {
    reply.send({
      success: true,
      user: {
        id: request.user.id,
        username: request.user.username,
        displayName: request.user.displayName,
        email: request.user.email,
        role: request.user.role
      }
    });
  });
}
