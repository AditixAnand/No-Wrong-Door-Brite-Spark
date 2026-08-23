import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let client;

async function getRedisClient() {
  if (client) return client;
  client = createClient({ url: REDIS_URL });
  client.on('error', (err) => console.error('Redis error:', err));
  await client.connect();
  return client;
}

async function closeRedis() {
  if (client) {
    await client.quit();
    client = undefined;
  }
}

export { getRedisClient, closeRedis };
