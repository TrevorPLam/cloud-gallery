# AI-META-BEGIN
# AI-META: Multi-stage Dockerfile for Cloud Gallery Node.js server
# OWNERSHIP: server/deployment
# ENTRYPOINTS: Docker build and deployment
# DEPENDENCIES: Node.js 18+, TypeScript, Drizzle ORM, Express
# DANGER: Multi-stage build complexity, non-root user permissions, production optimizations
# CHANGE-SAFETY: Build stage can be updated independently; base image versions may need updates
# TESTS: docker build, docker-compose up, health checks, migration automation
# AI-META-END

# ========================================
# Stage 1: Builder - Install dependencies and build TypeScript
# ========================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /build

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run server:build

# ========================================
# Stage 2: Production - Minimal runtime image
# ========================================
FROM node:18-alpine AS production

# Install runtime dependencies only
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /build/server_dist ./server_dist

# Copy drizzle config and migrations
COPY --from=builder /build/drizzle.config.ts ./
COPY --from=builder /build/shared ./shared

# Copy migration and startup script
COPY --from=builder /build/migrate-and-start.sh ./
RUN chmod +x migrate-and-start.sh

# Create non-root user with proper home directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check for the server
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use migration script as entrypoint to run migrations before starting server
ENTRYPOINT ["./migrate-and-start.sh"]
CMD ["node", "server_dist/index.js"]
