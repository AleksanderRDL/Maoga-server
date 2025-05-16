# Deployment Guide

This document outlines the deployment process and configuration for the gaming matchmaking platform, covering local development, staging, and production environments.

## 1. Deployment Environments

### 1.1 Local Development Environment

- **Purpose**: For individual developers to build and test features
- **Requirements**:
  - Node.js (v16+)
  - MongoDB (local or container)
  - Redis (optional, for advanced features)
  - Git

### 1.2 Testing Environment

- **Purpose**: For automated tests and continuous integration
- **Requirements**:
  - Docker and Docker Compose
  - GitHub Actions (or other CI/CD platform)
  - MongoDB in container
  - Redis in container

### 1.3 Staging Environment

- **Purpose**: For testing features in a production-like environment
- **Requirements**:
  - Cloud provider (AWS, Azure, GCP, etc.)
  - MongoDB Atlas (M10 or higher)
  - Redis Cache
  - Container registry
  - Container orchestration (Kubernetes or similar)

### 1.4 Production Environment

- **Purpose**: Live environment for users
- **Requirements**:
  - Cloud provider with high availability
  - MongoDB Atlas (M20 or higher) with replica set
  - Redis Cache with replication
  - Load balancer
  - CDN for static assets
  - Container orchestration with auto-scaling

## 2. Local Development Setup

### 2.1 Prerequisites

- Install Node.js v16 or higher
- Install MongoDB Community Edition
- Install Docker and Docker Compose (optional)
- Clone the repository

### 2.2 Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env.development
   ```

2. Update the environment variables:
   ```
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/gamematch
   JWT_SECRET=your_dev_jwt_secret
   JWT_REFRESH_SECRET=your_dev_refresh_secret
   ```

### 2.3 Installation

```bash
# Install dependencies
npm install

# Start MongoDB (if not running)
# On macOS/Linux
mongod --dbpath=/data/db

# On Windows
"C:\Program Files\MongoDB\Server\4.4\bin\mongod.exe" --dbpath="C:\data\db"
```

### 2.4 Starting the Application

```bash
# Run in development mode with hot reloading
npm run dev

# Alternative: Run using Docker Compose
docker-compose -f docker-compose.dev.yml up
```

### 2.5 Docker Compose for Development

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - PORT=3000
      - MONGODB_URI=mongodb://mongo:27017/gamematch
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    command: npm run dev

  mongo:
    image: mongo:4.4
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:6.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  mongo-data:
  redis-data:
```

## 3. Container Images

### 3.1 Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:16-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start application in development mode
CMD ["npm", "run", "dev"]
```

### 3.2 Production Dockerfile

```dockerfile
# Dockerfile
FROM node:16-alpine as builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Remove dev files
RUN rm -rf test .github .vscode

# Create production image
FROM node:16-alpine

# Set environment variables
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

### 3.3 Building Images

```bash
# Build development image
docker build -t gamematch-api:dev -f Dockerfile.dev .

# Build production image
docker build -t gamematch-api:latest .
```

## 4. Continuous Integration and Deployment

### 4.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:4.4
        ports:
          - 27017:27017
      
      redis:
        image: redis:6.2
        ports:
          - 6379:6379
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://localhost:27017/gamematch_test
          JWT_SECRET: test_jwt_secret
          JWT_REFRESH_SECRET: test_refresh_secret
      
      - name: Upload test results
        if: success() || failure()
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: coverage/
  
  build:
    name: Build
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      
      - name: Login to Container Registry
        uses: docker/login-action@v1
        with:
          registry: ${{ secrets.DOCKER_REGISTRY }}
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v3
        with:
          images: ${{ secrets.DOCKER_REGISTRY }}/gamematch-api
          tags: |
            type=ref,event=branch
            type=sha,format=short
      
      - name: Build and push
        uses: docker/build-push-action@v2
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
  
  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - name: Deploy to Staging
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USERNAME }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/gamematch
            docker-compose pull
            docker-compose up -d
  
  deploy-production:
    name: Deploy to Production
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - name: Deploy to Production Kubernetes
        uses: Azure/k8s-deploy@v1.4
        with:
          namespace: 'gamematch-prod'
          manifests: |
            kubernetes/deployment.yaml
            kubernetes/service.yaml
          images: ${{ secrets.DOCKER_REGISTRY }}/gamematch-api:${{ github.sha }}
          kubectl-version: 'latest'
```

## 5. Cloud Hosting Configurations

### 5.1 AWS Deployment

#### 5.1.1 AWS ECS (Elastic Container Service)

```yaml
# AWS CloudFormation template for ECS
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: gamematch-cluster
  
  ECSTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: gamematch-task
      Cpu: 1024
      Memory: 2048
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !Ref ECSTaskExecutionRole
      TaskRoleArn: !Ref ECSTaskRole
      ContainerDefinitions:
        - Name: gamematch-api
          Image: ${ContainerImage}
          Essential: true
          PortMappings:
            - ContainerPort: 3000
              HostPort: 3000
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: PORT
              Value: '3000'
            - Name: MONGODB_URI
              Value: !Sub 'mongodb+srv://${DBUsername}:${DBPassword}@${DBCluster}'
            - Name: REDIS_URL
              Value: !Sub 'redis://${RedisEndpoint}:6379'
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref CloudWatchLogsGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ecs
  
  ECSService:
    Type: AWS::ECS::Service
    DependsOn: LoadBalancerListener
    Properties:
      ServiceName: gamematch-service
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref ECSTaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      DeploymentConfiguration:
        MinimumHealthyPercent: 100
        MaximumPercent: 200
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: ENABLED
          SecurityGroups:
            - !Ref ContainerSecurityGroup
          Subnets:
            - !Ref PublicSubnet1
            - !Ref PublicSubnet2
      LoadBalancers:
        - ContainerName: gamematch-api
          ContainerPort: 3000
          TargetGroupArn: !Ref TargetGroup
```

#### 5.1.2 AWS Parameter Store Configuration

```bash
# Store sensitive configuration in AWS Parameter Store
aws ssm put-parameter \
  --name "/gamematch/prod/mongodb-uri" \
  --value "mongodb+srv://username:password@cluster.mongodb.net/gamematch" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/gamematch/prod/jwt-secret" \
  --value "your-secure-jwt-secret" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/gamematch/prod/redis-url" \
  --value "redis://your-redis-endpoint:6379" \
  --type "SecureString"
```

### 5.2 Docker Compose for Staging

```yaml
# docker-compose.staging.yml
version: '3.8'

services:
  app:
    image: ${DOCKER_REGISTRY}/gamematch-api:${IMAGE_TAG}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=staging
      - PORT=3000
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - REDIS_URL=${REDIS_URL}
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5.3 Kubernetes for Production

#### 5.3.1 Kubernetes Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gamematch-api
  namespace: gamematch-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gamematch-api
  template:
    metadata:
      labels:
        app: gamematch-api
    spec:
      containers:
      - name: gamematch-api
        image: ${DOCKER_REGISTRY}/gamematch-api:${IMAGE_TAG}
        ports:
        - containerPort: 3000
        resources:
          limits:
            cpu: "1"
            memory: "1Gi"
          requests:
            cpu: "500m"
            memory: "512Mi"
        envFrom:
        - configMapRef:
            name: gamematch-config
        - secretRef:
            name: gamematch-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### 5.3.2 Kubernetes Service

```yaml
# kubernetes/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: gamematch-api
  namespace: gamematch-prod
spec:
  selector:
    app: gamematch-api
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

#### 5.3.3 Kubernetes ConfigMap

```yaml
# kubernetes/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gamematch-config
  namespace: gamematch-prod
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://app.gamematch.com"
```

#### 5.3.4 Kubernetes Secrets

```yaml
# kubernetes/secrets.yaml (values should be base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: gamematch-secrets
  namespace: gamematch-prod
type: Opaque
data:
  MONGODB_URI: bW9uZ29kYitzcnY6Ly91c2VybmFtZTpwYXNzd29yZEBjbHVzdGVyLm1vbmdvZGIubmV0L2dhbWVtYXRjaA==
  JWT_SECRET: eW91ci1zZWN1cmUtand0LXNlY3JldA==
  JWT_REFRESH_SECRET: eW91ci1zZWN1cmUtcmVmcmVzaC1zZWNyZXQ=
  REDIS_URL: cmVkaXM6Ly95b3VyLXJlZGlzLWVuZHBvaW50OjYzNzk=
```

#### 5.3.5 Kubernetes Ingress

```yaml
# kubernetes/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gamematch-ingress
  namespace: gamematch-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.gamematch.com
    secretName: gamematch-tls
  rules:
  - host: api.gamematch.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: gamematch-api
            port:
              number: 80
```

### 5.4 Serverless Deployment (Alternative)

#### 5.4.1 AWS SAM Template

```yaml
# template.yaml (AWS SAM)
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Resources:
  GamematchAPI:
    Type: AWS::Serverless::Api
    Properties:
      StageName: Prod
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'Content-Type,Authorization'"
        AllowOrigin: "'https://app.gamematch.com'"
  
  GamematchFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: dist/lambda.handler
      Runtime: nodejs16.x
      MemorySize: 1024
      Timeout: 30
      Environment:
        Variables:
          NODE_ENV: production
          MONGODB_URI: !Sub '{{resolve:secretsmanager:${MongoDBSecret}:SecretString:uri}}'
          JWT_SECRET: !Sub '{{resolve:secretsmanager:${JWTSecret}:SecretString:secret}}'
      Events:
        ApiEvent:
          Type: Api
          Properties:
            RestApiId: !Ref GamematchAPI
            Path: /{proxy+}
            Method: ANY
```

#### 5.4.2 Lambda Entry Point

```javascript
// src/lambda.js
const serverless = require('serverless-http');
const app = require('./app');

// Create handler for AWS Lambda
module.exports.handler = serverless(app);
```

## 6. Database Setup and Migration

### 6.1 MongoDB Atlas Setup

1. Create a MongoDB Atlas account
2. Create a new cluster (M10 for staging, M20+ for production)
3. Configure network access (whitelist IPs or use VPC peering)
4. Create database users
5. Get connection string

### 6.2 Database Indexes

```javascript
// scripts/setupIndexes.js
const mongoose = require('mongoose');
const config = require('../src/config');
const User = require('../src/modules/user/models/User');
const Game = require('../src/modules/game/models/Game');
const Friendship = require('../src/modules/user/models/Friendship');
const MatchRequest = require('../src/modules/matchmaking/models/MatchRequest');
const Lobby = require('../src/modules/lobby/models/Lobby');
const Chat = require('../src/modules/chat/models/Chat');
const Message = require('../src/modules/chat/models/Message');
const Notification = require('../src/modules/notification/models/Notification');

async function setupIndexes() {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    console.log('Connected to MongoDB');
    
    // Create User indexes
    await User.createIndexes();
    console.log('User indexes created');
    
    // Create Game indexes
    await Game.createIndexes();
    console.log('Game indexes created');
    
    // Create Friendship indexes
    await Friendship.createIndexes();
    console.log('Friendship indexes created');
    
    // Create MatchRequest indexes
    await MatchRequest.createIndexes();
    console.log('MatchRequest indexes created');
    
    // Create Lobby indexes
    await Lobby.createIndexes();
    console.log('Lobby indexes created');
    
    // Create Chat indexes
    await Chat.createIndexes();
    console.log('Chat indexes created');
    
    // Create Message indexes
    await Message.createIndexes();
    console.log('Message indexes created');
    
    // Create Notification indexes
    await Notification.createIndexes();
    console.log('Notification indexes created');
    
    console.log('All indexes created successfully');
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupIndexes();
}

module.exports = setupIndexes;
```

### 6.3 Data Migration

```javascript
// scripts/migrate.js
const mongoose = require('mongoose');
const config = require('../src/config');
const migrations = require('./migrations');

async function migrate() {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    console.log('Connected to MongoDB');
    
    // Get all migration files
    const migrationFiles = migrations.sort((a, b) => a.version - b.version);
    
    // Run migrations
    for (const migration of migrationFiles) {
      console.log(`Running migration: ${migration.name} (${migration.version})`);
      await migration.up();
      console.log(`Migration completed: ${migration.name}`);
    }
    
    console.log('All migrations completed successfully');
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = migrate;
```

### 6.4 Example Migration

```javascript
// scripts/migrations/001-add-game-popularity.js
const Game = require('../../src/modules/game/models/Game');

module.exports = {
  version: 1,
  name: 'Add game popularity field',
  up: async () => {
    // Add popularity field to all games that don't have it
    await Game.updateMany(
      { popularity: { $exists: false } },
      { $set: { popularity: 50 } }
    );
    
    console.log('Added popularity field to games');
  }
};
```

## 7. Environment Monitoring and Logging

### 7.1 Logging Configuration

```javascript
// src/utils/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('../config');

// Define log formats
const formats = {
  console: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(
      info => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  file: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
};

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: formats.console,
    level: config.logging.level
  })
];

// Add file transports in staging and production
if (config.env !== 'development' && config.env !== 'test') {
  // Add daily rotate file transport
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: `${config.logging.directory}/application-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: formats.file,
      level: config.logging.level
    })
  );
  
  // Error log
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: `${config.logging.directory}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: formats.file,
      level: 'error'
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: config.logging.level,
  transports
});

module.exports = logger;
```

### 7.2 Application Monitoring

#### 7.2.1 Prometheus Configuration

```javascript
// src/middleware/metrics.js
const prometheus = require('prom-client');
const { Router } = require('express');

// Create a Registry
const register = new prometheus.Registry();

// Add default metrics
prometheus.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);

// Middleware to collect metrics
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  // Record metrics on response finish
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const status = res.statusCode;
    
    // Record duration
    httpRequestDuration.observe({ method, route, status }, duration);
    
    // Increment request counter
    httpRequestTotal.inc({ method, route, status });
  });
  
  next();
}

// Create metrics endpoint
const metricsRouter = Router();

metricsRouter.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = {
  metricsMiddleware,
  metricsRouter
};
```

### 7.3 Alerting Configuration

```yaml
# prometheus/alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
  - match:
      severity: critical
    receiver: 'slack-critical'
    continue: true

receivers:
- name: 'slack-notifications'
  slack_configs:
  - channel: '#monitoring'
    send_resolved: true
    title: "{{ .GroupLabels.alertname }}"
    text: "{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}"
    icon_emoji: ':warning:'

- name: 'slack-critical'
  slack_configs:
  - channel: '#incidents'
    send_resolved: true
    title: "CRITICAL: {{ .GroupLabels.alertname }}"
    text: "{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}"
    icon_emoji: ':rotating_light:'
```

## 8. Backup and Disaster Recovery

### 8.1 MongoDB Backup Strategy

#### 8.1.1 Automated Daily Backups

```bash
#!/bin/bash
# scripts/backup.sh

# Configuration
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="/path/to/backups"
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/gamematch"
S3_BUCKET="gamematch-backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup MongoDB
echo "Starting MongoDB backup..."
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb_$TIMESTAMP"

# Compress backup
echo "Compressing backup..."
tar -zcf "$BACKUP_DIR/mongodb_$TIMESTAMP.tar.gz" "$BACKUP_DIR/mongodb_$TIMESTAMP"
rm -rf "$BACKUP_DIR/mongodb_$TIMESTAMP"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR/mongodb_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/mongodb_$TIMESTAMP.tar.gz"

# Keep only last 7 days of backups locally
find "$BACKUP_DIR" -name "mongodb_*.tar.gz" -type f -mtime +7 -delete

echo "Backup completed successfully"
```

#### 8.1.2 MongoDB Atlas Backup

For production environments, use MongoDB Atlas continuous backups:

1. Navigate to Atlas UI > Clusters > Backup
2. Enable continuous backup
3. Configure backup policy (retention, frequency)
4. Set up point-in-time recovery

### 8.2 Redis Backup Strategy

```bash
#!/bin/bash
# scripts/redis-backup.sh

# Configuration
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="/path/to/backups"
REDIS_HOST="your-redis-host"
REDIS_PORT="6379"
REDIS_PASSWORD="your-redis-password"
S3_BUCKET="gamematch-backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup Redis
echo "Starting Redis backup..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR/redis_$TIMESTAMP.rdb.gz" "s3://$S3_BUCKET/redis_$TIMESTAMP.rdb.gz"

# Keep only last 7 days of backups locally
find "$BACKUP_DIR" -name "redis_*.rdb.gz" -type f -mtime +7 -delete

echo "Redis backup completed successfully"
```

### 8.3 Disaster Recovery Plan

```markdown
# Disaster Recovery Plan

## Recovery Time Objectives (RTO)
- Production system: 1 hour
- Staging system: 4 hours

## Recovery Point Objectives (RPO)
- Production data: 5 minutes
- Staging data: 1 day

## Recovery Procedures

### Database Failure
1. Identify the nature of the failure (hardware, software, corruption)
2. For MongoDB Atlas:
   - Use Atlas UI to restore from the latest backup
   - If point-in-time recovery is needed, use that feature
3. For self-managed MongoDB:
   - Restore from the latest backup:
     ```bash
     aws s3 cp s3://gamematch-backups/mongodb_latest.tar.gz /tmp/
     tar -xzf /tmp/mongodb_latest.tar.gz
     mongorestore --uri="$MONGODB_URI" /tmp/mongodb_latest
     ```
4. Verify data integrity after recovery

### Application Server Failure
1. Identify the nature of the failure
2. Scale up additional container instances:
   - For Kubernetes:
     ```bash
     kubectl scale deployment gamematch-api --replicas=5
     ```
   - For ECS:
     ```bash
     aws ecs update-service --cluster gamematch-cluster --service gamematch-service --desired-count 5
     ```
3. If container image is corrupted, roll back to the last known good image:
   ```bash
   kubectl rollout undo deployment/gamematch-api
   ```
4. Verify application health after recovery

### Complete System Failure
1. Activate the standby region/environment
2. Update DNS to point to the standby environment
3. Restore database from the latest backup
4. Verify system functionality
5. When the primary environment is ready, sync data back and switch traffic
```

## 9. Scaling Strategies

### 9.1 Horizontal Scaling

```yaml
# kubernetes/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gamematch-api-hpa
  namespace: gamematch-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gamematch-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 5
        periodSeconds: 15
      selectPolicy: Max
```

### 9.2 Database Scaling

#### 9.2.1 MongoDB Scaling

For MongoDB Atlas:
1. Upgrade cluster tier (M10 → M20 → M30 → M40)
2. Add more shards for horizontal scaling
3. Configure read preferences to use secondary nodes for read-heavy operations

#### 9.2.2 Redis Scaling

For Redis:
1. Use Redis Cluster for horizontal scaling
2. Implement Redis Sentinel for high availability
3. Use Redis Enterprise for managed scaling

### 9.3 Application Optimization

```javascript
// src/app.js

// Add compression middleware
app.use(compression());

// Add caching headers middleware
app.use((req, res, next) => {
  // Cache static assets for 1 day
  if (req.path.match(/\.(js|css|jpg|png|gif|ico)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  } else {
    // No cache for API endpoints
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
```

## 10. Security Considerations

### 10.1 SSL/TLS Configuration

```javascript
// src/server.js (HTTPS version)
const https = require('https');
const fs = require('fs');
const app = require('./app');
const config = require('./config');

// SSL options
const sslOptions = {
  key: fs.readFileSync('/path/to/private.key'),
  cert: fs.readFileSync('/path/to/certificate.crt'),
  ca: fs.readFileSync('/path/to/ca_bundle.crt'),
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES256-GCM-SHA384'
  ].join(':'),
  honorCipherOrder: true,
  minVersion: 'TLSv1.2'
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

// Start server
server.listen(config.port, () => {
  console.log(`HTTPS server running on port ${config.port}`);
});
```

### 10.2 Security Headers

```javascript
// src/middleware/securityHeaders.js
module.exports = (req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  
  // HTTP Strict Transport Security
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'same-origin');
  
  // Permissions-Policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  
  next();
};
```

### 10.3 Rate Limiting

```javascript
// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');

// API rate limiter
exports.apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'ratelimit:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

// Auth rate limiter (more strict)
exports.authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'ratelimit:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  }
});
```

## 11. Troubleshooting Guide

### 11.1 Common Issues and Solutions

```markdown
# Troubleshooting Guide

## Connection Issues

### MongoDB Connection Failures
- **Symptom**: Server fails to start with MongoDB connection errors
- **Solutions**:
  1. Check if MongoDB is running: `mongo --host <host> --port <port>`
  2. Verify network connectivity: `ping <mongodb-host>`
  3. Check MongoDB URI format
  4. Verify IP whitelist settings in MongoDB Atlas
  5. Check credentials

### Redis Connection Failures
- **Symptom**: Server starts but Redis features fail
- **Solutions**:
  1. Check if Redis is running: `redis-cli -h <host> -p <port> ping`
  2. Verify network connectivity
  3. Check Redis password
  4. Confirm Redis configuration in .env file

## Performance Issues

### Slow API Responses
- **Symptom**: API requests take longer than 500ms to respond
- **Solutions**:
  1. Check database query performance
  2. Look for missing indexes
  3. Enable query profiling
  4. Verify connection pool settings
  5. Check system resources (CPU, memory)

### Memory Leaks
- **Symptom**: Increasing memory usage over time
- **Solutions**:
  1. Use `--inspect` and Chrome DevTools to profile memory
  2. Check for unclosed connections
  3. Look for unresolved Promises
  4. Verify event listener cleanup

## Authentication Issues

### JWT Token Verification Failures
- **Symptom**: Users report being logged out frequently
- **Solutions**:
  1. Verify JWT_SECRET is consistent across deployments
  2. Check token expiration settings
  3. Verify clock synchronization between servers
  4. Check token format in client requests

## Container Issues

### Container Crashes
- **Symptom**: Container exits shortly after starting
- **Solutions**:
  1. Check container logs: `docker logs <container-id>`
  2. Verify environment variables
  3. Check for port conflicts
  4. Ensure sufficient memory allocation
```

### 11.2 Log Collection Script

```bash
#!/bin/bash
# scripts/collect-logs.sh

# Configuration
LOG_DIR="/path/to/logs"
OUTPUT_DIR="/path/to/diagnostic-output"
APP_NAME="gamematch-api"
DAYS=3

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Collect system info
echo "Collecting system information..."
uname -a > "$OUTPUT_DIR/system-info.txt"
free -h >> "$OUTPUT_DIR/system-info.txt"
df -h >> "$OUTPUT_DIR/system-info.txt"
top -b -n 1 >> "$OUTPUT_DIR/system-info.txt"

# Collect application logs
echo "Collecting application logs..."
find "$LOG_DIR" -name "application-*.log" -mtime -$DAYS -exec cp {} "$OUTPUT_DIR/" \;

# Collect error logs
echo "Collecting error logs..."
find "$LOG_DIR" -name "error-*.log" -mtime -$DAYS -exec cp {} "$OUTPUT_DIR/" \;

# Collect container logs
echo "Collecting container logs..."
if command -v docker &> /dev/null; then
  docker logs --tail 1000 $APP_NAME > "$OUTPUT_DIR/container-logs.txt" 2>&1
fi

# Collect Kubernetes pod logs
if command -v kubectl &> /dev/null; then
  kubectl logs --tail=1000 -l app=$APP_NAME -n gamematch-prod > "$OUTPUT_DIR/pod-logs.txt" 2>&1
fi

# Create a tar file
echo "Creating archive..."
tar -czf "$OUTPUT_DIR.tar.gz" "$OUTPUT_DIR"

echo "Log collection complete: $OUTPUT_DIR.tar.gz"
```

## 12. Production Deployment Checklist

```markdown
# Production Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] All tests are passing (unit, integration, API)
- [ ] Code linting passes without errors
- [ ] Code has been reviewed and approved
- [ ] Security scan completed with no critical issues

### Database
- [ ] Database indexes are created and optimized
- [ ] Database migrations have been tested
- [ ] Backup procedure is in place
- [ ] Connection pool settings are appropriate for production

### Environment Configuration
- [ ] All required environment variables are documented
- [ ] Secrets are stored securely (not in code)
- [ ] Production config has been verified
- [ ] MongoDB connection string is for production cluster
- [ ] Redis connection is configured correctly

### Security
- [ ] HTTPS is enabled with valid certificates
- [ ] Security headers are configured
- [ ] Rate limiting is in place
- [ ] Data validation is implemented for all inputs
- [ ] Authentication and authorization tested

## Deployment Process

### Build
- [ ] Build production Docker image
- [ ] Tag image with semantic version and git hash
- [ ] Push image to container registry

### Infrastructure
- [ ] Verify infrastructure is provisioned correctly
- [ ] Load balancer is configured
- [ ] DNS records are updated
- [ ] Health checks are configured
- [ ] Scaling policies are in place

### Deploy
- [ ] Deploy to staging environment first
- [ ] Verify functionality in staging
- [ ] Deploy to production with zero-downtime strategy
- [ ] Verify health checks passing after deployment
- [ ] Monitor for any errors after deployment

## Post-Deployment

### Verification
- [ ] Verify API endpoints return correct responses
- [ ] Check socket.io connections work correctly
- [ ] Verify database connections are stable
- [ ] Run smoke tests against production

### Monitoring
- [ ] Set up alerts for critical error rates
- [ ] Verify logs are being collected
- [ ] Dashboard is showing accurate metrics
- [ ] Set up uptime monitoring

### Documentation
- [ ] Update deployment documentation
- [ ] Document any changes to the deployment process
- [ ] Update API documentation if needed
```
