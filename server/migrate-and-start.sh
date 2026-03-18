#!/bin/sh
# AI-META-BEGIN
# AI-META: Database migration and server startup script for Docker
# OWNERSHIP: server/deployment
# ENTRYPOINTS: Docker container entrypoint
# DEPENDENCIES: Drizzle Kit, PostgreSQL connection, Node.js
# DANGER: Database operations, error handling, startup sequence
# CHANGE-SAFETY: Migration command can be updated; error handling patterns should persist
# TESTS: Container startup, migration execution, error scenarios
# AI-META-END

set -e

echo "🚀 Starting Cloud Gallery server with database migration..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
client.connect()
  .then(() => {
    console.log('✅ Database is ready');
    client.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database not ready:', err.message);
    process.exit(1);
  });
" do
  echo "Database is unavailable - sleeping"
  sleep 2
done

# Run database migrations
echo "🔄 Running database migrations..."
if ! npm run db:push; then
  echo "❌ Database migration failed"
  exit 1
fi

echo "✅ Database migrations completed successfully"

# Start the server
echo "🌟 Starting Cloud Gallery server..."
exec "$@"
