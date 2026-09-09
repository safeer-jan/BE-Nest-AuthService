import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(`blacklist:${jti}`, '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const value = await this.client.get(`blacklist:${jti}`);
    return value !== null;
  }

  async cacheUser(userId: string, payload: string, ttlSeconds = 300): Promise<void> {
    await this.client.set(`user:${userId}`, payload, 'EX', ttlSeconds);
  }

  async getCachedUser(userId: string): Promise<string | null> {
    return this.client.get(`user:${userId}`);
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.client.del(`user:${userId}`);
  }

  getClient(): Redis {
    return this.client;
  }
}
