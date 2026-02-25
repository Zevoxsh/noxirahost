#!/bin/sh
set -e

echo "================================================"
echo "  NebulaHosting Backend Starting..."
echo "================================================"

# Wait for Redis
echo "Waiting for Redis..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping > /dev/null 2>&1; then
    echo "Redis ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "  Attempt $attempt/$max_attempts..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "ERROR: Redis not available"
  exit 1
fi

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-nebula}" > /dev/null 2>&1; then
    echo "PostgreSQL ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "  Attempt $attempt/$max_attempts..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "ERROR: PostgreSQL not available"
  exit 1
fi

# Run migrations
echo "Running database migrations..."
node scripts/init-db.js

echo "================================================"
exec npm start
