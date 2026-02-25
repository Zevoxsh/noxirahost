/**
 * NebulaHosting Backend — Fastify Server
 * Structure basée sur NebulaProxyV3
 */

import dns from 'dns';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/config.js';
import { testPostgresConnection, closePool } from './config/database.js';
import { database } from './services/database.js';
import { redisService } from './services/redis.js';
import { registerAuthDecorators } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/user.js';
import { vmRoutes } from './routes/vms.js';
import { billingRoutes } from './routes/billing.js';
import { supportRoutes } from './routes/support.js';
import { isoRoutes, templateRoutes } from './routes/isos.js';
import { adminRoutes } from './routes/admin/index.js';
import { adminNodeRoutes } from './routes/admin/nodes.js';
import { adminPlanRoutes } from './routes/admin/plans.js';
import { adminUserRoutes } from './routes/admin/users.js';
import { adminVmRoutes } from './routes/admin/vms.js';
import { adminBillingRoutes } from './routes/admin/billing.js';
import { WebSocketManager } from './services/websocketManager.js';
import { stripeService } from './services/stripe.js';

// Prefer IPv4 to avoid Stripe timeouts on broken IPv6 routes
dns.setDefaultResultOrder('ipv4first');

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
    }
  },
  disableRequestLogging: true,
  trustProxy: true,
  bodyLimit: 10485760 // 10MB
});

// ─── CORS ──────────────────────────────────────────────
await fastify.register(cors, {
  origin: function (origin, callback) {
    if (!origin) { callback(null, true); return; }

    const allowedOrigins = config.allowedOrigins;
    if (allowedOrigins.includes(origin)) { callback(null, true); return; }

    try {
      const url = new URL(origin);
      const h = url.hostname;
      if (h === 'localhost' || h === '127.0.0.1' ||
          /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
        callback(null, true); return;
      }
    } catch { /* invalid URL */ }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
});

// ─── Plugins ───────────────────────────────────────────
await fastify.register(cookie, { secret: config.jwtSecret });
await fastify.register(jwt, {
  secret: config.jwtSecret,
  cookie: { cookieName: 'token', signed: false }
});
await fastify.register(rateLimit, {
  max: config.rateLimit.max,
  timeWindow: config.rateLimit.timeWindow,
  keyGenerator: (request) => request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.ip
});

// ─── Auth Decorators ────────────────────────────────────
registerAuthDecorators(fastify);

// ─── Raw Body pour Stripe webhook ──────────────────────
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  try {
    req.rawBody = body;
    done(null, JSON.parse(body.toString()));
  } catch (err) {
    done(err);
  }
});

// ─── Security Headers ──────────────────────────────────
fastify.addHook('onSend', async (request, reply) => {
  reply.removeHeader('X-Powered-By');
  reply.removeHeader('Server');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (config.nodeEnv === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
});

// ─── Health ────────────────────────────────────────────
fastify.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  service: 'NebulaHosting'
}));

// ─── Routes ────────────────────────────────────────────
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(userRoutes, { prefix: '/api/user' });
await fastify.register(vmRoutes, { prefix: '/api/vms' });
await fastify.register(billingRoutes, { prefix: '/api/billing' });
await fastify.register(supportRoutes, { prefix: '/api/support' });
await fastify.register(isoRoutes, { prefix: '/api/isos' });
await fastify.register(templateRoutes, { prefix: '/api/templates' });

// Admin
await fastify.register(adminRoutes, { prefix: '/api/admin' });
await fastify.register(adminNodeRoutes, { prefix: '/api/admin/nodes' });
await fastify.register(adminPlanRoutes, { prefix: '/api/admin/plans' });
await fastify.register(adminUserRoutes, { prefix: '/api/admin/users' });
await fastify.register(adminVmRoutes, { prefix: '/api/admin/vms' });
await fastify.register(adminBillingRoutes, { prefix: '/api/admin/billing' });

// ─── Start ─────────────────────────────────────────────
const start = async () => {
  try {
    const t = Date.now();
    console.log('\n===================================================');
    console.log('  NebulaHosting :: Startup');
    console.log('===================================================');

    // 1. PostgreSQL
    await testPostgresConnection();
    console.log('  PostgreSQL                         [OK]');

    // 2. Redis
    await redisService.init();
    console.log(`  Redis                              [${redisService.isConnected ? 'OK' : 'WARN - degraded mode'}]`);

    // 3. Démarrer Fastify
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`  API Listener                       [OK] ${config.host}:${config.port}`);

    // 4. WebSocket Manager (noVNC relay)
    const wsManager = new WebSocketManager(fastify.server, fastify.log);
    fastify.wsManager = wsManager;
    console.log('  WebSocket (noVNC relay)            [OK] /ws/console');

    console.log('---------------------------------------------------');
    console.log(`  Startup complete in ${Date.now() - t}ms`);
    console.log('===================================================\n');

    // 5. Stripe price sync (async, non-blocking)
    setTimeout(async () => {
      const timeoutMs = 8000;
      const withTimeout = (p) => Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stripe sync timeout')), timeoutMs))
      ]);

      try {
        const plans = await database.getAllPlans();
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (const plan of plans) {
          const missing = !plan.stripePriceId || plan.stripePriceId.includes('PLACEHOLDER');
          if (!missing) { skipped += 1; continue; }
          try {
            const stripePriceId = await withTimeout(stripeService.getOrCreatePriceForPlan(plan));
            await database.updatePlan(plan.id, { stripePriceId });
            updated += 1;
          } catch {
            failed += 1;
          }
        }

        fastify.log.info({ updated, skipped, failed }, 'Stripe price sync done');
      } catch (err) {
        fastify.log.warn({ err: err.message }, 'Stripe price sync skipped');
      }
    }, 0);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// ─── Graceful Shutdown ─────────────────────────────────
const shutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  try {
    if (fastify.wsManager) fastify.wsManager.close();
    await fastify.close();
    await closePool();
    await redisService.close();
    process.exit(0);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await start();
