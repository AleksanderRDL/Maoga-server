# syntax=docker/dockerfile:1.4
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Install dependencies needed for native Node modules
RUN apk add --no-cache python3 make g++

# Copy dependency manifests for root project and frontend app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install backend dependencies without running lifecycle scripts yet
RUN npm ci --ignore-scripts

# Install frontend dependencies explicitly to avoid relying on postinstall hooks
RUN npm --prefix frontend ci --ignore-scripts

# Copy the remaining application source
COPY . .

# Create logs directory expected by the app
RUN mkdir -p logs

# Switch to a non-root user provided by the Node base image
USER node

# Expose the API port
EXPOSE 3000

# Default command launches the backend dev server (nodemon)
CMD ["npm", "run", "dev:backend"]