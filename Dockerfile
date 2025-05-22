# Development Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Create logs directory
RUN mkdir -p logs

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "dev"]