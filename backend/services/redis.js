/**
 * Redis service — JWT blacklist, VNC tokens, cache
 * Basé sur NebulaProxyV3/backend/services/redis.js
 */

import Redis from 'ioredis';
import { config } from '../config/config.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async init() {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('[Redis] Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      await this.client.ping();
      return this;
    } catch (error) {
      console.warn('[Redis] Init failed — running degraded:', error.message);
      this.client = null;
      this.isConnected = false;
      return this;
    }
  }

  async blacklistToken(token, expiresAt) {
    if (!this.isConnected || !this.client) return false;
    try {
      const ttl = expiresAt - Math.floor(Date.now() / 1000);
      if (ttl <= 0) return true;
      await this.client.setex(`blacklist:${token}`, ttl, '1');
      return true;
    } catch (err) {
      console.error('[Redis] blacklistToken error:', err.message);
      return false;
    }
  }

  async isTokenBlacklisted(token) {
    if (!this.isConnected || !this.client) return false;
    try {
      return (await this.client.exists(`blacklist:${token}`)) === 1;
    } catch (err) {
      return false;
    }
  }

  /**
   * Stocker un token VNC à usage unique (TTL 60s)
   */
  async setVncToken(wsToken, data, ttlSeconds = 60) {
    if (!this.isConnected || !this.client) throw new Error('Redis not connected');
    await this.client.setex(`vnc:${wsToken}`, ttlSeconds, JSON.stringify(data));
  }

  /**
   * Récupérer et supprimer un token VNC (usage unique)
   */
  async popVncToken(wsToken) {
    if (!this.isConnected || !this.client) return null;
    const data = await this.client.get(`vnc:${wsToken}`);
    if (data) await this.client.del(`vnc:${wsToken}`);
    return data ? JSON.parse(data) : null;
  }

  async healthCheck() {
    if (!this.client) return false;
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

export const redisService = new RedisService();
