import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  get port() { return parseInt(process.env.PORT || '3010', 10); },
  get host() { return process.env.HOST || '0.0.0.0'; },
  get nodeEnv() { return process.env.NODE_ENV || 'development'; },

  get jwtSecret() { return process.env.JWT_SECRET || 'temporary-dev-secret-change-in-production-0000000'; },
  get jwtExpiry() { return process.env.JWT_EXPIRY || '24h'; },

  logging: {
    get level() { return (process.env.LOG_LEVEL || 'info').toLowerCase(); }
  },

  database: {
    get host() { return process.env.DB_HOST || 'localhost'; },
    get port() { return parseInt(process.env.DB_PORT || '5434', 10); },
    get name() { return process.env.DB_NAME || 'nebula_hosting'; },
    get user() { return process.env.DB_USER || 'nebula'; },
    get password() { return process.env.DB_PASSWORD || ''; },
    get poolMax() { return parseInt(process.env.DB_POOL_MAX || '20', 10); },
    get poolMin() { return parseInt(process.env.DB_POOL_MIN || '2', 10); }
  },

  redis: {
    get host() { return process.env.REDIS_HOST || 'localhost'; },
    get port() { return parseInt(process.env.REDIS_PORT || '6380', 10); },
    get password() { return process.env.REDIS_PASSWORD || ''; },
    get db() { return parseInt(process.env.REDIS_DB || '0', 10); }
  },

  proxmox: {
    get defaultNode() { return process.env.PROXMOX_DEFAULT_NODE || 'pve1'; },
    get host() { return process.env.PROXMOX_HOST || ''; },
    get port() { return parseInt(process.env.PROXMOX_PORT || '8006', 10); },
    get user() { return process.env.PROXMOX_USER || 'root@pam'; },
    get tokenId() { return process.env.PROXMOX_TOKEN_ID || ''; },
    get tokenSecret() { return process.env.PROXMOX_TOKEN_SECRET || ''; },
    get verifySsl() { return process.env.PROXMOX_VERIFY_SSL === 'true'; },
    get storage() { return process.env.PROXMOX_STORAGE || 'local'; },
    get bridge() { return process.env.PROXMOX_BRIDGE || 'vmbr0'; },
    get vmidStart() { return parseInt(process.env.PROXMOX_VMID_START || '200', 10); }
  },

  stripe: {
    get secretKey() { return process.env.STRIPE_SECRET_KEY || ''; },
    get publishableKey() { return process.env.STRIPE_PUBLISHABLE_KEY || ''; },
    get webhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET || ''; }
  },

  get frontendUrl() { return process.env.FRONTEND_URL || 'http://localhost:3011'; },

  smtp: {
    get host() { return process.env.SMTP_HOST || ''; },
    get port() { return parseInt(process.env.SMTP_PORT || '587', 10); },
    get secure() { return process.env.SMTP_SECURE === 'true'; },
    get user() { return process.env.SMTP_USER || ''; },
    get pass() { return process.env.SMTP_PASS || ''; },
    get fromEmail() { return process.env.SMTP_FROM_EMAIL || ''; },
    get fromName() { return process.env.SMTP_FROM_NAME || 'NebulaHosting'; }
  },

  get allowedOrigins() {
    return (process.env.ALLOWED_ORIGINS || 'http://localhost:3011,http://localhost:5173')
      .split(',').map(o => o.trim()).filter(Boolean);
  },

  rateLimit: {
    get max() { return parseInt(process.env.RATE_LIMIT_MAX || '100', 10); },
    get timeWindow() { return parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000', 10); }
  },

  security: {
    get csrfEnabled() { return process.env.CSRF_ENABLED === 'true'; }
  }
};
