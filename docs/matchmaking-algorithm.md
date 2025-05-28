# Matchmaking Algorithm Design

This document outlines the technical design of the matchmaking algorithm for the Maoga gaming platform. It is structured to guide the implementation of core features in Sprint 5 and lays out advanced functionalities for subsequent sprints.

## 1. Matchmaking Requirements (As Originally Defined)

### 1.1 Functional Requirements
- **Multi-game Support**: Match users across multiple games with weighted preferences.
- **Group Size Flexibility**: Support matching for various group sizes (1-to-many players).
- **Preference-based Matching**: Match based on user-defined preferences.
- **Fallback Mechanism**: Progressively relax constraints if optimal matches aren't found.
- **Region/Language Matching**: Consider geographical and language preferences.
- **Skill-based Matching**: Match players of similar skill levels.
- **Pre-selection Support**: Allow users to pre-select friends to match with.
- **Real-time & Scheduled Matching**: Support both immediate and future planned matches.

### 1.2 Non-functional Requirements
- **Fairness**: Algorithm should be unbiased.
- **Performance**: Efficient match formation.
- **Scalability**: Handle increasing concurrent requests.
- **Responsiveness**: Real-time feedback.
- **Stability**: Prevent match thrashing.
- **Adaptability**: Adjust to varying population sizes.

## 2. Core Matchmaking Algorithm (Sprint 5 Focus)

Sprint 5 will establish the foundation of the matchmaking system. The following components from your original design are key:

### 2.1 Service Integration
The matchmaking logic will reside within the `matchmaking` module, specifically in `MatchAlgorithmService`, interacting with a `MatchmakingService` and `MatchmakingController` as outlined in your `sprint-implementation-plan.md`.

### 2.2 Match Request Data Structure (Initial Version)
The `MatchRequest` schema defined in `sprint-implementation-plan.md` and your algorithm design document will be central. For Sprint 5, we'll focus on:
```javascript
// MatchRequest (Sprint 5 Focus) - Stored in MongoDB
{
  requestId: String,              // Unique identifier (auto-generated)
  userId: ObjectId,               // User making the request (from req.user)
  status: String,                 // "searching", "cancelled", "matched" (initially "searching")
  criteria: {
    games: [{                     // Game(s) to match for (primary focus for Sprint 5)
      gameId: ObjectId,           // Game identifier
      weight: Number              // Preference weight (1-10, but simple selection first)
    }],
    gameMode: String,             // e.g., "casual", "competitive"
    // groupSize: { min: Number, max: Number }, // Deferred to later sprints
    regionPreference: String,     // "strict", "preferred", "any" (focus on 'strict' and 'preferred' initially)
    regions: [String],            // Desired regions
    // languagePreference: String, // Deferred
    // languages: [String],       // Deferred
    skillPreference: String,      // "similar", "any" (simple implementation)
  },
  // preselectedUsers: [ObjectId], // Deferred
  searchStartTime: Date,          // When search started
  // matchExpireTime: Date,       // Deferred
  // relaxationLevel: Number,     // Deferred
  // relaxationTimestamp: Date,   // Deferred
  // matchedLobbyId: ObjectId,    // Set upon successful match
  createdAt: Date,
  updatedAt: Date
}
```
This aligns with the `MatchRequest` schema mentioned in Sprint 5 of `sprint-implementation-plan.md`.

### 2.3 Queue Management (In-Memory for Sprint 5)
As per your design and the Sprint 5 plan, requests will be organized into queues. For Sprint 5, an in-memory queue structure will be implemented.
-   **Structure**: Queues will be primarily based on:
    1.  **Primary Game ID**: The `gameId` from `MatchRequest.criteria.games` (likely the one with the highest weight or the only one specified).
    2.  **Game Mode**: e.g., `MatchRequest.criteria.gameMode`.
    3.  **Region**: e.g., primary region from `MatchRequest.criteria.regions`.

```javascript
// Simplified In-Memory Queue Structure for Sprint 5
// GameQueues = {
//   "gameId1": {
//     "competitive": {
//       "NA": [request1, request2, ...],
//       "EU": [request3, request4, ...],
//     },
//   },
// };
```
This approach is consistent with section 3.1.2 of your original `matchmaking-algorithm.md` and the Sprint 5 plan for in-memory queues.

### 2.4 Matching Algorithm (`MatchAlgorithmService`) - Initial Version
Sprint 5 focuses on a core set of criteria:
1.  **Game Selection**: Matching users who selected the same primary game.
2.  **Game Mode**: Matching users with the same game mode.
3.  **Region**: Matching users in the same region.
4.  **Skill Matching (Basic)**: If `User.gameProfiles.rank` is available, attempt to match users with similar ranks. This will be a simplified version of the skill score calculation.

The `MatchAlgorithmService` will contain the logic for this initial matching process.

### 2.5 Compatibility Score Calculation (Basic for Sprint 5)
A simplified version of `calculateCompatibilityScore` (section 3.2.1 of `matchmaking-algorithm.md`) will be implemented. For Sprint 5, this will primarily be a hard filter:
-   **Game Match**: Must be the same primary game.
-   **Game Mode Match**: Must be the same.
-   **Region Match**: Must be compatible based on user's `regionPreference` and selected `regions`.
-   **Skill Match (Basic)**: If skill data exists, a simple range check (e.g., +/- 1 rank tier).

A true "score" might not be fully implemented in Sprint 5, favoring direct criteria matching first.

### 2.6 Match History (Basic Tracking)
As per the Sprint 5 plan, a `MatchHistory` schema will be defined, and basic tracking will be implemented when the algorithm forms a match.
```javascript
// MatchHistory (Sprint 5 Initial)
{
  matchId: ObjectId,
  participants: [ObjectId], // Users in the match
  gameId: ObjectId,
  gameMode: String,
  formedAt: Date,
  // lobbyId: ObjectId // To be linked when lobbies are created
}
```

### 2.7 API Endpoints
The algorithm will support the Sprint 5 APIs:
-   `POST /api/matchmaking`: Users submit match requests. The service places these in the appropriate queue.
-   `DELETE /api/matchmaking/{requestId}`: Users cancel active requests. The service removes these from the queue.

### 2.8 Algorithm Validation Framework
Sprint 5 includes developing a basic framework/scripts to feed sample `MatchRequest` data and observe outputs to validate the initial algorithm logic.

---

## 3. Advanced Matchmaking Features (Future Sprints)

The following features, detailed in your original `matchmaking-algorithm.md`, will be implemented in later sprints (e.g., Sprint 9 for advanced matchmaking features).

### 3.1 Full Compatibility Score Calculation
Implement the complete `calculateCompatibilityScore` function as designed in section 3.2.1 of `matchmaking-algorithm.md`, including weighted scores for:
-   **Game Match Score** (Section 3.2.2): Considering multiple games and their weights.
-   **Region Match Score** (Section 3.2.3): Incorporating "strict", "preferred", and "any" preferences.
-   **Language Match Score**: Similar logic to region matching.
-   **Skill Match Score**: More nuanced skill comparison using `User.gameProfiles` and `skillPreference`.
-   **Group Size Compatibility**: Ensuring formed groups meet desired sizes.

### 3.2 Advanced Match Formation Algorithm
Implement the full `findOptimalMatches` logic using a **Weighted Bipartite Matching** approach (e.g., Hungarian algorithm variation) as described in section 3.3.2 of `matchmaking-algorithm.md`. This will involve:
-   Building a compatibility matrix.
-   Handling pre-selected user groups (see also section 4.2).
-   Finding the set of matches that maximizes overall compatibility.

### 3.3 Criteria Relaxation Strategy
Implement the progressive `relaxCriteria` function (section 3.4 of `matchmaking-algorithm.md`). This involves:
-   Defining relaxation stages (e.g., 1-10 levels).
-   Periodically checking long-waiting requests and applying relaxation rules (e.g., widening skill range, making region/language preferences less strict, considering less preferred games).
-   Updating `MatchRequest.relaxationLevel` and `MatchRequest.relaxationTimestamp`.

### 3.4 Match Finalization and Lobby Creation (Sprint 7 Integration)
Integrate with the Lobby System (planned for Sprint 7). The `finalizeMatch` function (section 3.5 of `matchmaking-algorithm.md`) will:
-   Call `LobbyService.createLobby()` upon finding a match.
-   Update `MatchRequest` status to "matched" and link `matchedLobbyId`.
-   Trigger notifications to users about the formed match and lobby (integrating with Notification System - Sprint 8).

### 3.5 Special Matching Considerations
#### 3.5.1 Scheduled Matchmaking (Sprint 9)
Implement handling for `MatchRequest.criteria.scheduledTime` as per section 4.1 of `matchmaking-algorithm.md`. This includes:
-   A separate queue/logic for scheduled requests.
-   Triggering matching closer to the `scheduledTime`.

#### 3.5.2 Pre-made Group Matchmaking (Sprint 9)
Implement support for `MatchRequest.preselectedUsers` (section 4.2 of `matchmaking-algorithm.md` and Sprint 9 plan):
-   Algorithm attempts to keep these groups intact.
-   API to add friends to an active matchmaking request.

#### 3.5.3 Small User Base Optimization
Implement strategies for periods with few active users (section 4.3 of `matchmaking-algorithm.md`):
-   Dynamically lower compatibility thresholds.
-   Increase relaxation rate.
-   Prioritize forming any viable matches over strictly optimal ones.

### 3.6 Background Processing & Real-time Updates
Refine background job processing (section 5.1 of `matchmaking-algorithm.md`) for matchmaking, criteria relaxation, and scheduled matches.
Enhance real-time status updates via WebSockets (Socket.IO planned for Sprint 6) as detailed in section 5.2 of `matchmaking-algorithm.md`, providing users with:
-   Current search status.
-   Elapsed search time.
-   Estimated time remaining (if predictable).
-   Number of potential matches found (if applicable).

### 3.7 Performance Optimizations
Implement performance strategies from section 5.3 of `matchmaking-algorithm.md`, such as:
-   Database indexing for `MatchRequest` collections.
-   Caching frequently accessed data (user profiles, game details relevant to matching).
-   Batch processing of requests.
-   Potentially sharding queues for very high-load games/regions.

## 4. Testing and Validation (Ongoing & Future)
Continue and expand upon the testing strategies outlined in your original `matchmaking-algorithm.md` (section 6) and your `testing-practices.md`.
-   **Algorithm Validation Metrics** (Section 6.1): Track match quality, wait times, success rates, fairness, and preference satisfaction.
-   **Simulation Testing** (Section 6.2): Develop more sophisticated simulations as features are added.
-   **A/B Testing Strategy** (Section 6.3): Once the platform is more mature, use A/B testing for algorithm variations.

## 5. Future Enhancements (Post-Core Implementation)
These align with section 7 of your `matchmaking-algorithm.md`:
### 5.1 Machine Learning Integration
-   **Preference Prediction**: Learn user preferences from past behavior and game history.
-   **Wait Time Prediction**: More accurately predict wait times.
-   **Satisfaction Prediction**: Predict user satisfaction with potential matches to improve match quality.
-   **Dynamic Weights**: Allow ML models to adjust criteria weights based on learned importance and current platform conditions.

### 5.2 Social Graph Integration
-   **Friend-of-Friend Matching**: Prioritize matching with friends-of-friends.
-   **Past Partner Preference/Avoidance**: Consider explicit or implicit feedback from past matches.
-   **Community Detection**: Identify and match within player communities or guilds.
-   **Karma-Based Matching**: Use the karma point system (Sprint 10) as a factor in matchmaking.

### 5.3 Adaptive Time-Based Strategies
-   **Peak/Off-Peak Adjustments**: Optimize for throughput during high traffic and relax criteria more quickly during low traffic.
-   **Regional Patterns**: Account for typical activity patterns in different geographical regions.
-   **Game-Specific Timing**: Adjust strategies based on typical play patterns and session lengths for individual games.

---