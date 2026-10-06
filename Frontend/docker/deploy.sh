#!/bin/bash
# Rebuild and restart the dashboard container.
# Run from the Frontend/ directory on the server.
#
# NEVER pass --remove-orphans: the shared manipal_network makes the
# production stack (gateway, app, db, celery, crm) look like orphans
# to this compose project, and they would be destroyed.
set -e

cd "$(dirname "$0")/.."

echo "🚀 Building manipal_dashboard..."
docker compose -f docker/docker-compose.yml build --no-cache

echo "🔄 Restarting container..."
docker compose -f docker/docker-compose.yml up -d

echo "🩺 Health check..."
sleep 3
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/healthz)
if [ "$code" = "200" ]; then
  echo "✅ Deployment completed — dashboard healthy on :8090"
else
  echo "❌ Health check failed (HTTP $code)"
  docker logs --tail 30 manipal_dashboard_development
  exit 1
fi
