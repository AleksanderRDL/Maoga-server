# Matchmaking Algorithm Design

This document outlines the technical design of the matchmaking algorithm that will power the gaming matchmaking platform. The algorithm is designed to match players based on various criteria including games, skills, preferences, and social factors.

## 1. Matchmaking Requirements
### 1.1 Functional Requirements
- **Multi-game Support**: Match users across multiple games with weighted preferences
- **Group Size Flexibility**: Support matching for various group sizes (1-to-many players)
- **Preference-based Matching**: Match based on user-defined preferences
- **Fallback Mechanism**: Progressively relax constraints if optimal matches aren't found
- **Region/Language Matching**: Consider geographical and language preferences
- **Skill-based Matching**: Match players of similar skill levels
- **Pre-selection Support**: Allow users to pre-select friends to match with
- **Real-time & Scheduled Matching**: Support both immediate and future planned matches

### 1.2 Non-functional Requirements
- **Fairness**: Algorithm should be unbiased and not consistently disadvantage any players
- **Performance**: Match formation should be efficient, even with a growing user base
- **Scalability**: Design should handle increasing numbers of concurrent match requests
- **Responsiveness**: Provide real-time feedback on matching status
- **Stability**: Prevent match thrashing (rapidly forming and disbanding matches)
- **Adaptability**: Adjust to varying population sizes and peak/off-peak hours

## 2. High-Level Algorithm Design
### 2.1 Algorithm Phases
The matchmaking algorithm operates in four main phases:

1. **Initialization**: Process incoming match requests and prepare for matching
2. **Candidate Selection**: Identify potential match candidates based on criteria
3. **Match Formation**: Form optimal matches from the candidate pool
4. **Match Finalization**: Create lobbies and notify matched players

### 2.2 Service Architecture

```
+-------------------+     +------------------+     +-------------------+
| MatchRequest      |     | MatchingEngine   |     | MatchResult       |
| Service           | --> | Service          | --> | Service           |
| (Queue Management)|     | (Core Algorithm) |     | (Lobby Creation)  |
+-------------------+     +------------------+     +-------------------+
         ^                        ^                         |
         |                        |                         v
+-------------------+     +------------------+     +-------------------+
| User Profile      |     | Game Profile     |     | Notification      |
| Service           |     | Service          |     | Service           |
| (Preferences)     |     | (Game Data)      |     | (Match Alerts)    |
+-------------------+     +------------------+     +-------------------+
```

### 2.3 Algorithm Overview
1. Match requests are collected from users and placed in appropriate queues
2. The matching engine periodically processes queues to form matches
3. As time passes, matching criteria are progressively relaxed
4. When matches are formed, lobbies are created and users are notified
5. Users confirm their participation, and the match is finalized or adjusted

## 3. Detailed Algorithm Design
### 3.1 Match Request Processing
#### 3.1.1 Data Structure
```javascript
// Match request structure
{
  requestId: String,              // Unique identifier
  userId: ObjectId,               // User making the request
  status: String,                 // "searching", "matched", "cancelled", "expired"
  criteria: {
    games: [{                     // Games to match for
      gameId: ObjectId,           // Game identifier
      weight: Number              // Preference weight (1-10)
    }],
    gameMode: String,             // "casual", "competitive", etc.
    groupSize: {                  // Desired group size
      min: Number,
      max: Number
    },
    regionPreference: String,     // "strict", "preferred", "any"
    regions: [String],            // Desired regions
    languagePreference: String,   // "strict", "preferred", "any"
    languages: [String],          // Desired languages
    skillPreference: String,      // "similar", "higher", "lower", "any"
  },
  preselectedUsers: [ObjectId],   // Friends to match with
  searchStartTime: Date,          // When search started
  matchExpireTime: Date,          // When to expire the search
  relaxationLevel: Number,        // How relaxed the criteria have become (0-10)
  relaxationTimestamp: Date,      // When criteria were last relaxed
  matchedLobbyId: ObjectId,       // Resulting lobby (if matched)
  createdAt: Date,
  updatedAt: Date
}
```
#### 3.1.2 Queue Structure
Requests are organized into queues based on:
1. Primary game (highest weight game)
2. Game mode
3. Region

```
GameQueues = {
  "game1": {
    "competitive": {
      "NA": [request1, request2, ...],
      "EU": [request3, request4, ...],
      ...
    },
    "casual": {
      ...
    }
  },
  "game2": {
    ...
  }
}
```

### 3.2 Matching Criteria Evaluation
#### 3.2.1 Compatibility Score Calculation
For each pair of users (A and B), a compatibility score is calculated:

```javascript
function calculateCompatibilityScore(requestA, requestB) {
  let score = 0;
  const maxScore = 100;
  
  // Game match score (up to 40 points)
  const gameScore = calculateGameMatchScore(requestA.criteria.games, requestB.criteria.games);
  score += gameScore * 0.4;
  
  // Region match score (up to 20 points)
  const regionScore = calculateRegionMatchScore(
    requestA.criteria.regions, 
    requestB.criteria.regions,
    requestA.criteria.regionPreference,
    requestB.criteria.regionPreference
  );
  score += regionScore * 0.2;
  
  // Language match score (up to 15 points)
  const languageScore = calculateLanguageMatchScore(
    requestA.criteria.languages,
    requestB.criteria.languages,
    requestA.criteria.languagePreference,
    requestB.criteria.languagePreference
  );
  score += languageScore * 0.15;
  
  // Skill match score (up to 15 points)
  const skillScore = calculateSkillMatchScore(
    requestA.userId,
    requestB.userId,
    requestA.criteria.skillPreference,
    requestB.criteria.skillPreference
  );
  score += skillScore * 0.15;
  
  // Group size compatibility (up to 10 points)
  const groupSizeScore = calculateGroupSizeCompatibility(
    requestA.criteria.groupSize,
    requestB.criteria.groupSize,
    requestA.preselectedUsers.length,
    requestB.preselectedUsers.length
  );
  score += groupSizeScore * 0.1;
  
  return score;
}
```
#### 3.2.2 Game Match Score
```javascript
function calculateGameMatchScore(gamesA, gamesB) {
  // Find common games
  const commonGames = gamesA.filter(gameA => 
    gamesB.some(gameB => gameB.gameId.equals(gameA.gameId))
  );
  
  if (commonGames.length === 0) {
    return 0;
  }
  
  // Calculate weighted score based on preference weights
  let totalWeightA = 0;
  let totalWeightB = 0;
  let weightedMatchScore = 0;
  
  commonGames.forEach(gameA => {
    const gameB = gamesB.find(g => g.gameId.equals(gameA.gameId));
    weightedMatchScore += gameA.weight * gameB.weight;
  });
  
  gamesA.forEach(game => totalWeightA += game.weight);
  gamesB.forEach(game => totalWeightB += game.weight);
  
  return (weightedMatchScore / (totalWeightA * totalWeightB)) * 100;
}
```
#### 3.2.3 Region Match Score
```javascript
function calculateRegionMatchScore(regionsA, regionsB, prefA, prefB) {
  // If either has 'any' preference, full score
  if (prefA === 'any' || prefB === 'any') {
    return 100;
  }
  
  // Find common regions
  const commonRegions = regionsA.filter(r => regionsB.includes(r));
  
  if (commonRegions.length === 0) {
    // No common regions
    return 0;
  }
  
  // If both have 'strict' preference and have common regions, full score
  if (prefA === 'strict' && prefB === 'strict' && commonRegions.length > 0) {
    return 100;
  }
  
  // Otherwise, score based on percentage of common regions
  const maxRegions = Math.max(regionsA.length, regionsB.length);
  return (commonRegions.length / maxRegions) * 100;
}
```

### 3.3 Match Formation Algorithm
#### 3.3.1 Core Matching Process
```javascript
async function processMatchQueue(gameId, gameMode, region) {
  // Get all active requests for this queue
  const requests = await getActiveRequests(gameId, gameMode, region);
  
  // If insufficient requests, exit
  if (requests.length < 2) {
    return [];
  }
  
  // Build compatibility matrix
  const compatibilityMatrix = buildCompatibilityMatrix(requests);
  
  // Group pre-selected users together
  const preselectedGroups = groupPreselectedUsers(requests);
  
  // Apply matching algorithm (using maximum weighted bipartite matching)
  const matches = findOptimalMatches(compatibilityMatrix, preselectedGroups);
  
  // Form lobbies from matches
  const lobbies = createLobbiesFromMatches(matches);
  
  return lobbies;
}
```
#### 3.3.2 Weighted Bipartite Matching Implementation
For optimal matching, we implement a variation of the Hungarian algorithm:

```javascript
function findOptimalMatches(compatibilityMatrix, preselectedGroups) {
  // Group requests based on preselected groups
  const requestGroups = [...preselectedGroups];
  
  // Add individual requests not in preselected groups
  // [Implementation details for grouping]
  
  // Form bipartite graph between compatible groups
  const graph = new BipartiteGraph();
  
  // Add edges between compatible groups with weights = compatibility scores
  for (let i = 0; i < requestGroups.length; i++) {
    for (let j = i + 1; j < requestGroups.length; j++) {
      const groupA = requestGroups[i];
      const groupB = requestGroups[j];
      
      // Calculate group compatibility score
      const score = calculateGroupCompatibility(groupA, groupB);
      
      // Check if groups can be matched (size constraints, etc.)
      if (canGroupsMatch(groupA, groupB) && score > MINIMUM_COMPATIBILITY_THRESHOLD) {
        graph.addEdge(i, j, score);
      }
    }
  }
  
  // Apply maximum weight matching algorithm
  const matchedPairs = graph.maximumWeightMatching();
  
  // Convert matched pairs into player groups
  return convertMatchedPairsToGroups(matchedPairs, requestGroups);
}
```

### 3.4 Criteria Relaxation Strategy
As time passes, matchmaking criteria are progressively relaxed to ensure players find matches within a reasonable time.

#### 3.4.1 Relaxation Stages
```javascript
function relaxCriteria(request) {
  const currentLevel = request.relaxationLevel || 0;
  const newLevel = currentLevel + 1;
  
  // Calculate time since last relaxation
  const timeSinceLastRelaxation = Date.now() - (request.relaxationTimestamp || request.searchStartTime);
  
  // Only relax if enough time has passed
  if (timeSinceLastRelaxation < RELAXATION_INTERVAL_MS) {
    return request;
  }
  
  // Apply relaxation based on level
  let updatedRequest = { ...request, relaxationLevel: newLevel, relaxationTimestamp: new Date() };
  
  switch (newLevel) {
    case 1:
      // Slightly expand region preference
      if (updatedRequest.criteria.regionPreference === 'strict') {
        updatedRequest.criteria.regionPreference = 'preferred';
      }
      break;
    case 2:
      // Expand skill range
      // [Implementation to widen skill range]
      break;
    case 3:
      // Adjust language preference
      if (updatedRequest.criteria.languagePreference === 'strict') {
        updatedRequest.criteria.languagePreference = 'preferred';
      }
      break;
    case 4:
      // Further expand region
      if (updatedRequest.criteria.regionPreference === 'preferred') {
        updatedRequest.criteria.regionPreference = 'any';
      }
      break;
    case 5:
      // Consider less preferred games
      // [Implementation to include more games]
      break;
    case 6:
      // Further relax language constraint
      updatedRequest.criteria.languagePreference = 'any';
      break;
    case 7:
      // Adjust group size constraints slightly
      // [Implementation to adjust group size]
      break;
    case 8:
      // Significantly expand skill range
      // [Implementation to greatly widen skill range]
      break;
    case 9:
      // Maximum relaxation - consider all games
      // [Implementation to consider all possible games]
      break;
    case 10:
      // Maximum relaxation - consider all parameters at most relaxed settings
      // [Implementation for maximum relaxation]
      break;
  }
  
  return updatedRequest;
}
```

### 3.5 Match Finalization and Lobby Creation
Once matches are formed, they need to be finalized and lobbies created:

```javascript
async function finalizeMatch(matchedUsers, primaryGameId, gameMode) {
  // Create a new lobby
  const lobby = await createLobby({
    status: 'forming',
    game: {
      gameId: primaryGameId,
      gameMode: gameMode
    },
    members: matchedUsers.map(userId => ({
      userId,
      status: 'invited',
      joinedAt: new Date(),
      isHost: false // Will assign a host later
    })),
    capacity: {
      min: matchedUsers.length,
      max: matchedUsers.length,
      current: 0 // Will be updated as users join
    },
    chat: {
      enabled: true,
      history: []
    },
    lobbySettings: {
      public: false,
      joinable: true,
      autoDisband: true,
      disbandAfterMinutes: 30
    },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  });
  
  // Assign a random host
  const hostIndex = Math.floor(Math.random() * matchedUsers.length);
  lobby.members[hostIndex].isHost = true;
  await lobby.save();
  
  // Update all match requests to "matched" status
  for (const userId of matchedUsers) {
    await updateMatchRequest(userId, {
      status: 'matched',
      matchedLobbyId: lobby._id
    });
  }
  
  // Notify all users about the match
  for (const userId of matchedUsers) {
    await notifyUserAboutMatch(userId, lobby._id);
  }
  
  return lobby;
}
```

## 4. Special Matching Considerations
### 4.1 Scheduled Matchmaking
For non-immediate matchmaking:

```javascript
function processScheduledMatches() {
  // Get all scheduled matches approaching their time
  // (e.g., within the next 15 minutes)
  const upcomingScheduledMatches = getUpcomingScheduledMatches();
  
  // Group by game, mode, and approximate time
  const groupedMatches = groupScheduledMatches(upcomingScheduledMatches);
  
  // Process each group
  for (const matchGroup of groupedMatches) {
    // Apply matching algorithm to this group
    const matches = findOptimalMatches(buildCompatibilityMatrix(matchGroup.requests));
    
    // Create lobbies with scheduled start time
    const lobbies = createScheduledLobbiesFromMatches(matches, matchGroup.scheduledTime);
    
    // Notify users about upcoming matches
    notifyUsersAboutScheduledMatches(lobbies);
  }
}
```

### 4.2 Pre-selected Friends Handling
When users want to match along with their friends:

```javascript
function groupPreselectedUsers(requests) {
  const userGroups = new Map(); // userId -> groupId
  const groups = []; // Array of groups
  
  // First pass: Create initial groups from preselected users
  for (const request of requests) {
    if (request.preselectedUsers.length > 0) {
      // Create a new group for this request
      const groupId = groups.length;
      const group = {
        id: groupId,
        members: [request.userId, ...request.preselectedUsers],
        requests: [request]
      };
      
      // Map all users to this group
      userGroups.set(request.userId.toString(), groupId);
      for (const friendId of request.preselectedUsers) {
        userGroups.set(friendId.toString(), groupId);
      }
      
      groups.push(group);
    }
  }
  
  // Second pass: Merge overlapping groups
  const mergedGroups = mergeOverlappingGroups(groups);
  
  // Third pass: Add remaining requests that match preselected users
  for (const request of requests) {
    const groupId = userGroups.get(request.userId.toString());
    if (groupId !== undefined && !mergedGroups[groupId].requests.includes(request)) {
      mergedGroups[groupId].requests.push(request);
    }
  }
  
  // Fourth pass: Create single-user groups for remaining requests
  for (const request of requests) {
    if (!userGroups.has(request.userId.toString())) {
      const groupId = mergedGroups.length;
      mergedGroups.push({
        id: groupId,
        members: [request.userId],
        requests: [request]
      });
      userGroups.set(request.userId.toString(), groupId);
    }
  }
  
  return mergedGroups;
}
```

### 4.3 Small User Base Optimization
For periods with few active users:

```javascript
function optimizeForSmallUserBase(requests) {
  // If total requests below threshold, use different strategy
  if (requests.length < SMALL_USER_BASE_THRESHOLD) {
    // Lower compatibility thresholds
    MINIMUM_COMPATIBILITY_THRESHOLD *= 0.7;
    
    // Increase relaxation rate
    RELAXATION_INTERVAL_MS /= 2;
    
    // Prioritize creating any viable matches over optimal matches
    return findViableMatches(requests);
  } else {
    // Use standard algorithm
    return findOptimalMatches(buildCompatibilityMatrix(requests));
  }
}
```

## 5. Implementation Strategy
### 5.1 Background Processing
The matchmaking process will run as a background job:

```javascript
// Scheduled job that runs the matchmaking algorithm
function scheduleMatchmakingJob() {
  // Process immediate matchmaking every few seconds
  setInterval(async () => {
    try {
      await processAllMatchmakingQueues();
    } catch (error) {
      logger.error('Error processing matchmaking queues', error);
    }
  }, MATCHMAKING_INTERVAL_MS);
  
  // Process scheduled matchmaking every minute
  setInterval(async () => {
    try {
      await processScheduledMatches();
    } catch (error) {
      logger.error('Error processing scheduled matches', error);
    }
  }, 60 * 1000);
  
  // Relax criteria for long-waiting requests every minute
  setInterval(async () => {
    try {
      await relaxLongWaitingRequests();
    } catch (error) {
      logger.error('Error relaxing criteria', error);
    }
  }, 60 * 1000);
}
```
### 5.2 Real-time Status Updates
Users need to receive real-time updates on their matchmaking status:

```javascript
function updateMatchmakingStatus(userId, requestId) {
  // Get current request status
  const request = getMatchRequest(userId, requestId);
  
  // Calculate metrics
  const elapsedTime = Date.now() - request.searchStartTime;
  const estimatedTimeRemaining = calculateEstimatedTime(request);
  const potentialMatches = countPotentialMatches(request);
  
  // Send status via WebSocket
  sendWebSocketEvent(userId, 'matchmaking:status', {
    requestId,
    status: request.status,
    searchTime: Math.floor(elapsedTime / 1000),
    potentialMatches,
    matchedLobbyId: request.matchedLobbyId,
    estimatedTimeRemaining
  });
}
```
### 5.3 Performance Optimizations
To ensure the matchmaking system performs well:

1. **Indexing**: Maintain indexes on frequently queried fields
2. **Caching**: Cache user profiles and preferences during matching
3. **Batching**: Process matches in batches to avoid overloading
4. **Sharding**: Shard matchmaking queues by game and region
5. **Time Limit**: Cap computation time for large match pools

```javascript
function processMatchmakingWithTimeLimit(requests, timeLimit) {
  const startTime = Date.now();
  const results = [];
  
  // Process in batches
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    // Check if time limit is approaching
    if (Date.now() - startTime > timeLimit * 0.8) {
      // Time is running out, use faster algorithm for remaining requests
      const remainingRequests = requests.slice(i);
      return [...results, ...processRemainingQuickly(remainingRequests)];
    }
    
    const batch = requests.slice(i, i + BATCH_SIZE);
    const batchResults = processMatchBatch(batch);
    results.push(...batchResults);
  }
  
  return results;
}
```

## 6. Testing and Validation
### 6.1 Algorithm Validation Metrics
To evaluate the algorithm's effectiveness, we'll track:

1. **Match Quality**: Average compatibility score of formed matches
2. **Wait Time**: Average time users wait for matches
3. **Success Rate**: Percentage of requests that result in matches
4. **Fairness**: Distribution of wait times across different user segments
5. **Preference Satisfaction**: How well matches align with user preferences

### 6.2 Simulation Testing
Before deploying to production, we'll run simulations:

```javascript
async function runMatchmakingSimulation(config) {
  const {
    userCount,
    gameDistribution,
    regionDistribution,
    requestFrequency,
    simulationDuration
  } = config;
  
  // Generate simulated users
  const users = generateSimulatedUsers(userCount, gameDistribution, regionDistribution);
  
  // Generate simulated match requests over time
  const requests = generateSimulatedRequests(users, requestFrequency, simulationDuration);
  
  // Run simulation
  const results = await simulateMatchmaking(requests);
  
  // Analyze results
  return analyzeSimulationResults(results);
}
```

### 6.3 A/B Testing Strategy
Once deployed, we can use A/B testing to compare algorithm variations:

1. **Control Group**: Users matched with current algorithm
2. **Test Group**: Users matched with modified algorithm
3. **Metrics**: Compare match quality, wait times, and user satisfaction
4. **Feedback**: Collect explicit feedback on match quality

## 7. Future Enhancements
### 7.1 Machine Learning Integration
Future versions could incorporate machine learning:

1. **Preference Prediction**: Learn user preferences from past behavior
2. **Wait Time Prediction**: Predict wait times for different matchmaking criteria
3. **Satisfaction Prediction**: Predict user satisfaction with potential matches
4. **Dynamic Weights**: Adjust criteria weights based on learned importance

### 7.2 Social Graph Integration
Enhance matching with social graph data:

1. **Friend-of-Friend Matching**: Prefer matching with friends-of-friends
2. **Past Partner Preference**: Consider feedback from past matches
3. **Community Detection**: Identify and match within communities
4. **Karma-Based Matching**: Use karma/reputation in match formation

### 7.3 Adaptive Time-Based Strategies
Adjust strategies based on time of day:

1. **Peak Hours**: Optimize for throughput during high-traffic periods
2. **Off Hours**: Relax criteria more quickly during low-traffic periods
3. **Regional Patterns**: Account for activity patterns in different regions
4. **Game-Specific Timing**: Adjust based on typical play patterns for each game
