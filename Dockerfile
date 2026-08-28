# Production Multi-Stage Dockerfile for Google Cloud Run

# -------------------------------------------------------------
# Stage 1: Build (Vite Frontend & Server Bundle)
# -------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install full dependencies for building
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend assets and bundle server.ts -> dist/server.cjs
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Runtime
# -------------------------------------------------------------
FROM node:20-slim AS runner

# Install ca-certificates for secure outbound Google Drive & Gemini API calls
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set Cloud Run production environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy manifests and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built distribution from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

EXPOSE 8080

# Run bundled production server
CMD ["node", "dist/server.cjs"]
