# API Specifications

This document defines the API endpoints for the gaming matchmaking platform, organizing them by module and including request/response formats.

## 1. API Standards

### 1.1 Request/Response Format

All API endpoints follow these standards:

- **Request Format**:
  - For `GET` requests, parameters are passed in the query string
  - For `POST`, `PUT`, and `PATCH` requests, parameters are passed in the request body as JSON
  - Authentication is handled via JWT token in the `Authorization` header

- **Response Format**:
  ```json
  {
    "status": "success" | "error",
    "data": { /* response data */ },
    "message": "Optional message",
    "meta": {
      "pagination": { /* pagination info if applicable */ }
    }
  }
  ```

- **Error Format**:
  ```json
  {
    "status": "error",
    "error": {
      "code": "ERROR_CODE",
      "message": "Error message",
      "details": { /* additional error details */ }
    }
  }
  ```

### 1.2 Authentication

- Protected endpoints require an `Authorization` header with the format `Bearer {token}`
- The token is a JWT issued during login or token refresh
- Expired tokens return a 401 Unauthorized response

### 1.3 Pagination

For endpoints returning lists, pagination is supported with these query parameters:
- `limit`: Number of items per page (default: 20, max: 100)
- `page`: Page number (starts at 1)
- `sort`: Field to sort by
- `direction`: Sort direction (`asc` or `desc`)

The response includes pagination metadata:
```json
"meta": {
  "pagination": {
    "totalItems": 100,
    "itemsPerPage": 20,
    "currentPage": 1,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 2. Auth API

### 2.1 Register

- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Auth**: None
- **Request**:
  ```json
  {
    "email": "user@example.com",
    "username": "gamertag",
    "password": "securePassword123",
    "displayName": "Display Name"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "user_id",
        "username": "gamertag",
        "displayName": "Display Name",
        "email": "user@example.com"
      },
      "token": "jwt_token"
    }
  }
  ```

### 2.2 Login

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Auth**: None
- **Request**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "user_id",
        "username": "gamertag",
        "displayName": "Display Name",
        "email": "user@example.com"
      },
      "token": "jwt_token",
      "refreshToken": "refresh_token"
    }
  }
  ```

### 2.3 Refresh Token

- **URL**: `/api/auth/refresh-token`
- **Method**: `POST`
- **Auth**: None
- **Request**:
  ```json
  {
    "refreshToken": "refresh_token"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "token": "new_jwt_token",
      "refreshToken": "new_refresh_token"
    }
  }
  ```

### 2.4 Reset Password Request

- **URL**: `/api/auth/reset-password`
- **Method**: `POST`
- **Auth**: None
- **Request**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "If the email exists, a reset password link has been sent"
  }
  ```

### 2.5 Reset Password Confirmation

- **URL**: `/api/auth/reset-password/confirm`
- **Method**: `POST`
- **Auth**: None
- **Request**:
  ```json
  {
    "token": "reset_password_token",
    "password": "newSecurePassword123"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Password has been reset successfully"
  }
  ```

### 2.6 Logout

- **URL**: `/api/auth/logout`
- **Method**: `POST`
- **Auth**: Required
- **Request**: Empty
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Logged out successfully"
  }
  ```

## 3. User API

### 3.1 Get Current User Profile

- **URL**: `/api/users/me`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "user_id",
        "username": "gamertag",
        "displayName": "Display Name",
        "email": "user@example.com",
        "profileImage": "https://example.com/image.jpg",
        "bio": "User biography",
        "status": "User status",
        "location": {
          "country": "Country",
          "region": "Region",
          "language": ["English", "Spanish"]
        },
        "gameProfiles": [
          {
            "gameId": "game_id",
            "gameName": "Game Name",
            "inGameName": "InGameName",
            "rank": "Platinum",
            "playStyle": "Aggressive",
            "role": "Support",
            "experience": "Expert"
          }
        ],
        "socialLinks": [
          {
            "platform": "discord",
            "username": "discord_username",
            "url": "https://discord.gg/user"
          }
        ],
        "karmaPoints": 150,
        "createdAt": "2023-01-01T00:00:00Z"
      }
    }
  }
  ```

### 3.2 Update Profile

- **URL**: `/api/users/me`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**:
  ```json
  {
    "displayName": "New Display Name",
    "bio": "Updated biography",
    "status": "New status",
    "location": {
      "country": "New Country",
      "region": "New Region",
      "language": ["English", "French"]
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "user_id",
        "displayName": "New Display Name",
        "bio": "Updated biography",
        "status": "New status",
        "location": {
          "country": "New Country",
          "region": "New Region",
          "language": ["English", "French"]
        },
        "updatedAt": "2023-01-02T00:00:00Z"
      }
    }
  }
  ```

### 3.3 Upload Profile Image

- **URL**: `/api/users/me/image`
- **Method**: `POST`
- **Auth**: Required
- **Request**: Form data with `image` field containing the file
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "profileImage": "https://example.com/new-image.jpg"
    }
  }
  ```

### 3.4 Update Game Profiles

- **URL**: `/api/users/me/game-profiles`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "gameId": "game_id",
    "inGameName": "NewGameName",
    "rank": "Diamond",
    "playStyle": "Strategic",
    "role": "DPS",
    "experience": "Veteran"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "gameProfile": {
        "gameId": "game_id",
        "gameName": "Game Name",
        "inGameName": "NewGameName",
        "rank": "Diamond",
        "playStyle": "Strategic",
        "role": "DPS",
        "experience": "Veteran"
      }
    }
  }
  ```

### 3.5 Delete Game Profile

- **URL**: `/api/users/me/game-profiles/{gameId}`
- **Method**: `DELETE`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Game profile removed successfully"
  }
  ```

### 3.6 Update Preferences

- **URL**: `/api/users/me/preferences`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**:
  ```json
  {
    "preferredGames": ["game_id_1", "game_id_2"],
    "gameWeights": [
      { "gameId": "game_id_1", "weight": 8 },
      { "gameId": "game_id_2", "weight": 5 }
    ],
    "competitiveness": "competitive",
    "playTimes": [
      { "day": "monday", "startTime": "18:00", "endTime": "22:00" },
      { "day": "saturday", "startTime": "14:00", "endTime": "23:00" }
    ],
    "regionPreference": "preferred",
    "languagePreference": "strict",
    "skillPreference": "similar",
    "groupSize": { "min": 2, "max": 5 }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "preferences": {
        // Updated preferences as shown in the request
      }
    }
  }
  ```

### 3.7 Update Privacy Settings

- **URL**: `/api/users/me/privacy`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**:
  ```json
  {
    "profile": "friends",
    "onlineStatus": "public",
    "gameActivity": "private"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "visibilitySettings": {
        "profile": "friends",
        "onlineStatus": "public",
        "gameActivity": "private"
      }
    }
  }
  ```

### 3.8 Update Notification Settings

- **URL**: `/api/users/me/notifications/settings`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**:
  ```json
  {
    "email": true,
    "push": true,
    "matchmaking": true,
    "friendRequests": true,
    "messages": false,
    "systemUpdates": false
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "notificationSettings": {
        "email": true,
        "push": true,
        "matchmaking": true,
        "friendRequests": true,
        "messages": false,
        "systemUpdates": false
      }
    }
  }
  ```

### 3.9 Register Device Token

- **URL**: `/api/users/me/devices`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "deviceToken": "device_token",
    "deviceType": "ios" // or "android", "web"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Device registered successfully"
  }
  ```

### 3.10 Get User by Username

- **URL**: `/api/users/{username}`
- **Method**: `GET`
- **Auth**: Required
- **Response**: Similar to User Profile, but with limited information based on privacy settings

## 4. Friend API

### 4.1 Get Friends List

- **URL**: `/api/friends`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**:
  - `status`: Filter by friendship status (`pending`, `accepted`, `blocked`)
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "friends": [
        {
          "id": "user_id",
          "username": "friend_username",
          "displayName": "Friend Name",
          "profileImage": "https://example.com/image.jpg",
          "status": "Online",
          "currentGame": "Game Name",
          "friendshipStatus": "accepted",
          "friendSince": "2023-01-15T00:00:00Z"
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 4.2 Send Friend Request

- **URL**: `/api/friends/requests`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "username": "target_username"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "friendship": {
        "id": "friendship_id",
        "status": "pending",
        "user": {
          "id": "target_user_id",
          "username": "target_username",
          "displayName": "Target Display Name",
          "profileImage": "https://example.com/image.jpg"
        },
        "requestedAt": "2023-01-20T00:00:00Z"
      }
    }
  }
  ```

### 4.3 Get Friend Requests

- **URL**: `/api/friends/requests`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "requests": [
        {
          "id": "friendship_id",
          "user": {
            "id": "requester_id",
            "username": "requester_username",
            "displayName": "Requester Display Name",
            "profileImage": "https://example.com/image.jpg"
          },
          "requestedAt": "2023-01-22T00:00:00Z"
        }
      ]
    }
  }
  ```

### 4.4 Respond to Friend Request

- **URL**: `/api/friends/requests/{requestId}`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**:
  ```json
  {
    "action": "accept" // or "reject"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "friendship": {
        "id": "friendship_id",
        "status": "accepted", // or "rejected"
        "user": {
          "id": "requester_id",
          "username": "requester_username",
          "displayName": "Requester Display Name"
        },
        "updatedAt": "2023-01-23T00:00:00Z"
      }
    }
  }
  ```

### 4.5 Remove Friend

- **URL**: `/api/friends/{friendId}`
- **Method**: `DELETE`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Friend removed successfully"
  }
  ```

### 4.6 Block User

- **URL**: `/api/friends/block`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "username": "user_to_block"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User blocked successfully"
  }
  ```

### 4.7 Unblock User

- **URL**: `/api/friends/block/{userId}`
- **Method**: `DELETE`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User unblocked successfully"
  }
  ```

### 4.8 Get Blocked Users

- **URL**: `/api/friends/blocked`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "blockedUsers": [
        {
          "id": "blocked_user_id",
          "username": "blocked_username",
          "blockedAt": "2023-01-25T00:00:00Z"
        }
      ]
    }
  }
  ```

## 5. Game API

### 5.1 Get Games List

- **URL**: `/api/games`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**:
  - `platform`: Filter by platform
  - `genre`: Filter by genre
  - `search`: Search by name
  - Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "games": [
        {
          "id": "game_id",
          "name": "Game Name",
          "slug": "game-name",
          "coverImage": "https://example.com/cover.jpg",
          "genres": ["FPS", "Action"],
          "platforms": ["PC", "PlayStation"],
          "popularity": 95,
          "playerCount": { "min": 1, "max": 5 }
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 5.2 Get Game Details

- **URL**: `/api/games/{gameId}`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "game": {
        "id": "game_id",
        "name": "Game Name",
        "slug": "game-name",
        "description": "Detailed game description",
        "coverImage": "https://example.com/cover.jpg",
        "genres": ["FPS", "Action"],
        "platforms": ["PC", "PlayStation"],
        "releaseDate": "2022-01-01T00:00:00Z",
        "developer": "Developer Studio",
        "publisher": "Publisher Inc.",
        "rankSystem": {
          "type": "tier",
          "tiers": ["Bronze", "Silver", "Gold", "Platinum"],
          "description": "Ranking system description"
        },
        "roles": ["Tank", "Support", "DPS"],
        "playerCount": { "min": 1, "max": 5 },
        "popularity": 95
      }
    }
  }
  ```

### 5.3 Get Popular Games

- **URL**: `/api/games/popular`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**:
  - `limit`: Number of games to return (default: 10)
- **Response**: Similar to Games List but limited to the most popular games

### 5.4 Search Games

- **URL**: `/api/games/search`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**:
  - `query`: Search term
  - Pagination parameters
- **Response**: Similar to Games List filtered by search term

## 6. Matchmaking API

### 6.1 Start Matchmaking

- **URL**: `/api/matchmaking`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "games": [
      { "gameId": "game_id_1", "weight": 10 },
      { "gameId": "game_id_2", "weight": 5 }
    ],
    "gameMode": "competitive",
    "groupSize": { "min": 3, "max": 5 },
    "regionPreference": "preferred",
    "regions": ["NA-East", "EU-West"],
    "languagePreference": "strict",
    "languages": ["English", "Spanish"],
    "skillPreference": "similar",
    "scheduledTime": "2023-02-01T20:00:00Z",
    "preselectedUsers": ["friend_id_1", "friend_id_2"]
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "matchRequest": {
        "id": "match_request_id",
        "status": "searching",
        "criteria": {
          // Same as request
        },
        "searchStartTime": "2023-01-30T00:00:00Z",
        "matchExpireTime": "2023-01-30T01:00:00Z"
      }
    }
  }
  ```

### 6.2 Get Matchmaking Status

- **URL**: `/api/matchmaking/{requestId}`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "matchStatus": {
        "requestId": "match_request_id",
        "status": "searching", // or "matched", "cancelled", "expired"
        "searchTime": 300, // seconds elapsed
        "potentialMatches": 3, // number of potential matches found
        "matchedLobbyId": null, // or lobby_id if matched
        "estimatedTimeRemaining": 120 // seconds estimated remaining
      }
    }
  }
  ```

### 6.3 Cancel Matchmaking

- **URL**: `/api/matchmaking/{requestId}`
- **Method**: `DELETE`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Matchmaking cancelled successfully"
  }
  ```

### 6.4 Update Matchmaking Criteria

- **URL**: `/api/matchmaking/{requestId}`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**: Partial matchmaking criteria (same format as start)
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "matchRequest": {
        "id": "match_request_id",
        "status": "searching",
        "criteria": {
          // Updated criteria
        },
        "updatedAt": "2023-01-30T00:15:00Z"
      }
    }
  }
  ```

### 6.5 Get Active Matchmaking Request

- **URL**: `/api/matchmaking/active`
- **Method**: `GET`
- **Auth**: Required
- **Response**: Similar to matchmaking status if active, or empty data object

### 6.6 Add Friends to Matchmaking

- **URL**: `/api/matchmaking/{requestId}/friends`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "friendIds": ["friend_id_3", "friend_id_4"]
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "matchRequest": {
        "id": "match_request_id",
        "preselectedUsers": ["friend_id_1", "friend_id_2", "friend_id_3", "friend_id_4"],
        "updatedAt": "2023-01-30T00:20:00Z"
      }
    }
  }
  ```

### 6.7 Get Match History

- **URL**: `/api/matchmaking/history`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**: Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "history": [
        {
          "id": "match_id",
          "game": {
            "id": "game_id",
            "name": "Game Name"
          },
          "lobby": {
            "id": "lobby_id",
            "name": "Lobby Name"
          },
          "status": "completed", // or "cancelled"
          "members": [
            {
              "id": "user_id",
              "username": "username",
              "displayName": "Display Name"
            }
          ],
          "startTime": "2023-01-25T00:00:00Z",
          "endTime": "2023-01-25T02:00:00Z"
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

## 7. Lobby API

### 7.1 Get Lobby Details

- **URL**: `/api/lobbies/{lobbyId}`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "lobby": {
        "id": "lobby_id",
        "name": "Lobby Name",
        "status": "forming", // or "ready", "active", "closed"
        "game": {
          "id": "game_id",
          "name": "Game Name",
          "gameMode": "competitive"
        },
        "members": [
          {
            "id": "user_id",
            "username": "username",
            "displayName": "Display Name",
            "profileImage": "https://example.com/image.jpg",
            "status": "joined", // or "ready", "left"
            "isHost": true,
            "joinedAt": "2023-01-30T01:00:00Z"
          }
        ],
        "capacity": {
          "min": 3,
          "max": 5,
          "current": 2
        },
        "chat": {
          "enabled": true
        },
        "lobbySettings": {
          "public": false,
          "joinable": true,
          "autoDisband": true,
          "disbandAfterMinutes": 30
        },
        "autoMessage": "I'm looking for chill players for ranked",
        "createdAt": "2023-01-30T01:00:00Z",
        "expiresAt": "2023-01-30T03:00:00Z"
      }
    }
  }
  ```

### 7.2 Get User Lobbies

- **URL**: `/api/lobbies/me`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "lobbies": [
        {
          "id": "lobby_id",
          "name": "Lobby Name",
          "status": "forming",
          "game": {
            "id": "game_id",
            "name": "Game Name"
          },
          "memberCount": 3,
          "capacity": { "min": 3, "max": 5 },
          "isHost": false,
          "createdAt": "2023-01-30T01:00:00Z"
        }
      ]
    }
  }
  ```

### 7.3 Create Lobby

- **URL**: `/api/lobbies`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "gameId": "game_id",
    "gameMode": "casual",
    "capacity": { "min": 2, "max": 4 },
    "settings": {
      "public": true,
      "joinable": true,
      "autoDisband": false,
      "disbandAfterMinutes": 60
    },
    "autoMessage": "Looking for casual players!"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "lobby": {
        "id": "lobby_id",
        "name": "Generated Lobby Name",
        "status": "forming",
        "game": {
          "id": "game_id",
          "name": "Game Name",
          "gameMode": "casual"
        },
        "members": [
          {
            "id": "user_id",
            "username": "username",
            "isHost": true,
            "status": "joined"
          }
        ],
        "capacity": { "min": 2, "max": 4, "current": 1 },
        "createdAt": "2023-01-30T02:00:00Z"
      }
    }
  }
  ```

### 7.4 Update Lobby Settings

- **URL**: `/api/lobbies/{lobbyId}`
- **Method**: `PATCH`
- **Auth**: Required (host only)
- **Request**:
  ```json
  {
    "settings": {
      "public": false,
      "joinable": true,
      "autoDisband": true,
      "disbandAfterMinutes": 45
    },
    "autoMessage": "Updated message"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "lobby": {
        "id": "lobby_id",
        "settings": {
          "public": false,
          "joinable": true,
          "autoDisband": true,
          "disbandAfterMinutes": 45
        },
        "autoMessage": "Updated message",
        "updatedAt": "2023-01-30T02:15:00Z"
      }
    }
  }
  ```

### 7.5 Close Lobby

- **URL**: `/api/lobbies/{lobbyId}`
- **Method**: `DELETE`
- **Auth**: Required (host only)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Lobby closed successfully"
  }
  ```

### 7.6 Join Lobby

- **URL**: `/api/lobbies/{lobbyId}/join`
- **Method**: `POST`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "lobby": {
        "id": "lobby_id",
        "status": "forming",
        "members": [
          // Array of members including new member
        ],
        "capacity": { "min": 2, "max": 4, "current": 2 }
      }
    }
  }
  ```

### 7.7 Leave Lobby

- **URL**: `/api/lobbies/{lobbyId}/leave`
- **Method**: `POST`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Left lobby successfully"
  }
  ```

### 7.8 Set Ready Status

- **URL**: `/api/lobbies/{lobbyId}/ready`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "ready": true
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "member": {
        "id": "user_id",
        "readyStatus": true,
        "updatedAt": "2023-01-30T02:30:00Z"
      }
    }
  }
  ```

### 7.9 Kick Member

- **URL**: `/api/lobbies/{lobbyId}/members/{userId}`
- **Method**: `DELETE`
- **Auth**: Required (host only)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Member kicked successfully"
  }
  ```

### 7.10 Invite to Lobby

- **URL**: `/api/lobbies/{lobbyId}/invite`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "username": "friend_username"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Invitation sent successfully"
  }
  ```

### 7.11 Transfer Host

- **URL**: `/api/lobbies/{lobbyId}/host`
- **Method**: `PATCH`
- **Auth**: Required (host only)
- **Request**:
  ```json
  {
    "newHostId": "user_id"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "lobby": {
        "id": "lobby_id",
        "members": [
          // Array of members with updated host flag
        ],
        "updatedAt": "2023-01-30T02:45:00Z"
      }
    }
  }
  ```

## 8. Chat API

### 8.1 Get Lobby Chat

- **URL**: `/api/chat/lobbies/{lobbyId}`
- **Method**: `GET`
- **Auth**: Required (lobby member only)
- **Query Parameters**: Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "chat": {
        "id": "chat_id",
        "messages": [
          {
            "id": "message_id",
            "sender": {
              "id": "user_id",
              "username": "username",
              "displayName": "Display Name",
              "profileImage": "https://example.com/image.jpg"
            },
            "content": "Hello everyone!",
            "contentType": "text",
            "createdAt": "2023-01-30T02:50:00Z"
          }
        ]
      }
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 8.2 Get Direct Chat

- **URL**: `/api/chat/direct/{userId}`
- **Method**: `GET`
- **Auth**: Required (friends only)
- **Query Parameters**: Pagination parameters
- **Response**: Similar to Lobby Chat

### 8.3 Get User Chats

- **URL**: `/api/chat`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "chats": [
        {
          "id": "chat_id",
          "chatType": "direct",
          "participant": {
            "id": "user_id",
            "username": "username",
            "displayName": "Display Name",
            "profileImage": "https://example.com/image.jpg",
            "status": "Online"
          },
          "lastMessage": {
            "content": "Hello there!",
            "sender": {
              "id": "sender_id",
              "username": "sender_username"
            },
            "createdAt": "2023-01-30T03:00:00Z"
          },
          "unreadCount": 3
        }
      ]
    }
  }
  ```

### 8.4 Mark Chat as Read

- **URL**: `/api/chat/{chatId}/read`
- **Method**: `POST`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Chat marked as read"
  }
  ```

### 8.5 Upload Media

- **URL**: `/api/chat/{chatId}/media`
- **Method**: `POST`
- **Auth**: Required
- **Request**: Form data with `file` field containing the media
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "mediaUrl": "https://example.com/media.jpg"
    }
  }
  ```

### 8.6 Delete Message

- **URL**: `/api/chat/{chatId}/messages/{messageId}`
- **Method**: `DELETE`
- **Auth**: Required (message sender only)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Message deleted successfully"
  }
  ```

## 9. Notification API

### 9.1 Get Notifications

- **URL**: `/api/notifications`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**:
  - `status`: Filter by status (`unread`, `read`, `all`)
  - Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "notifications": [
        {
          "id": "notification_id",
          "type": "friendRequest",
          "title": "New Friend Request",
          "message": "username sent you a friend request",
          "data": {
            "referenceType": "user",
            "referenceId": "user_id"
          },
          "status": "unread",
          "createdAt": "2023-01-30T03:15:00Z"
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 9.2 Get Notification Count

- **URL**: `/api/notifications/count`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "total": 15,
      "unread": 5
    }
  }
  ```

### 9.3 Mark Notification as Read

- **URL**: `/api/notifications/{notificationId}`
- **Method**: `PATCH`
- **Auth**: Required
- **Request**:
  ```json
  {
    "status": "read"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "notification": {
        "id": "notification_id",
        "status": "read",
        "updatedAt": "2023-01-30T03:20:00Z"
      }
    }
  }
  ```

### 9.4 Mark All Notifications as Read

- **URL**: `/api/notifications/read-all`
- **Method**: `POST`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "All notifications marked as read"
  }
  ```

### 9.5 Delete Notification

- **URL**: `/api/notifications/{notificationId}`
- **Method**: `DELETE`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Notification deleted successfully"
  }
  ```

## 10. WebSocket API

The application uses Socket.IO for real-time communications.

### 10.1 Connection

- **URL**: `/socket.io`
- **Auth**: JWT token passed in handshake query parameter

### 10.2 Events

#### 10.2.1 Client to Server Events

- `chat:join`: Join a chat room
  ```json
  { "chatId": "chat_id" }
  ```

- `chat:leave`: Leave a chat room
  ```json
  { "chatId": "chat_id" }
  ```

- `chat:message`: Send a message to a chat
  ```json
  {
    "chatId": "chat_id",
    "content": "Hello there!",
    "contentType": "text"
  }
  ```

- `chat:typing`: Indicate typing status
  ```json
  {
    "chatId": "chat_id",
    "isTyping": true
  }
  ```

- `lobby:join`: Join a lobby
  ```json
  { "lobbyId": "lobby_id" }
  ```

- `lobby:leave`: Leave a lobby
  ```json
  { "lobbyId": "lobby_id" }
  ```

- `matchmaking:status`: Request matchmaking status update
  ```json
  { "requestId": "request_id" }
  ```

#### 10.2.2 Server to Client Events

- `user:status`: User status update
  ```json
  {
    "userId": "user_id",
    "status": "online", // or "offline", "away", "in-game"
    "updatedAt": "2023-01-30T03:30:00Z"
  }
  ```

- `chat:message`: New message received
  ```json
  {
    "chatId": "chat_id",
    "message": {
      "id": "message_id",
      "sender": {
        "id": "user_id",
        "username": "username",
        "displayName": "Display Name"
      },
      "content": "Hello there!",
      "contentType": "text",
      "createdAt": "2023-01-30T03:35:00Z"
    }
  }
  ```

- `chat:typing`: User typing status
  ```json
  {
    "chatId": "chat_id",
    "user": {
      "id": "user_id",
      "username": "username"
    },
    "isTyping": true
  }
  ```

- `lobby:update`: Lobby update
  ```json
  {
    "lobbyId": "lobby_id",
    "update": {
      "status": "ready",
      "members": [
        // Updated members list
      ],
      "updatedAt": "2023-01-30T03:40:00Z"
    }
  }
  ```

- `matchmaking:status`: Matchmaking status update
  ```json
  {
    "requestId": "request_id",
    "status": "matching",
    "progress": 50, // Percentage of matching progress
    "potentialMatches": 2,
    "estimatedTimeRemaining": 60,
    "lobbyId": null,
    "updatedAt": "2023-01-30T03:45:00Z"
  }
  ```

- `matchmaking:matched`: Match found
  ```json
  {
    "requestId": "request_id",
    "lobbyId": "lobby_id",
    "game": {
      "id": "game_id",
      "name": "Game Name"
    },
    "matchedAt": "2023-01-30T03:50:00Z"
  }
  ```

- `notification:new`: New notification
  ```json
  {
    "notification": {
      "id": "notification_id",
      "type": "lobbyInvite",
      "title": "Lobby Invitation",
      "message": "username invited you to join their lobby",
      "data": {
        "referenceType": "lobby",
        "referenceId": "lobby_id"
      },
      "createdAt": "2023-01-30T03:55:00Z"
    }
  }
  ```

- `notification:count`: Updated notification count
  ```json
  {
    "total": 16,
    "unread": 6
  }
  ```

## 11. Admin API (Future)

### 11.1 List Users

- **URL**: `/api/admin/users`
- **Method**: `GET`
- **Auth**: Required (admin only)
- **Query Parameters**:
  - `status`: Filter by account status
  - `search`: Search by username or email
  - Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "users": [
        {
          "id": "user_id",
          "username": "username",
          "email": "user@example.com",
          "displayName": "Display Name",
          "accountStatus": "active",
          "role": "user",
          "createdAt": "2023-01-01T00:00:00Z",
          "lastActive": "2023-01-30T00:00:00Z"
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 11.2 Update User Status

- **URL**: `/api/admin/users/{userId}/status`
- **Method**: `PATCH`
- **Auth**: Required (admin only)
- **Request**:
  ```json
  {
    "status": "suspended", // or "active", "banned"
    "reason": "Violation of terms of service",
    "duration": 7 // days, null for permanent
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "user_id",
        "username": "username",
        "accountStatus": "suspended",
        "suspendedUntil": "2023-02-06T00:00:00Z",
        "updatedAt": "2023-01-30T04:00:00Z"
      }
    }
  }
  ```

### 11.3 Get Reports

- **URL**: `/api/admin/reports`
- **Method**: `GET`
- **Auth**: Required (admin only)
- **Query Parameters**:
  - `status`: Filter by report status
  - `type`: Filter by report type
  - Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "reports": [
        {
          "id": "report_id",
          "type": "user",
          "reporter": {
            "id": "reporter_id",
            "username": "reporter_username"
          },
          "reported": {
            "id": "reported_id",
            "username": "reported_username"
          },
          "reason": "Inappropriate behavior",
          "status": "pending",
          "createdAt": "2023-01-30T01:00:00Z"
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 11.4 Update Report Status

- **URL**: `/api/admin/reports/{reportId}`
- **Method**: `PATCH`
- **Auth**: Required (admin only)
- **Request**:
  ```json
  {
    "status": "resolved", // or "rejected"
    "adminNote": "User warned",
    "action": "warning" // or "suspend", "ban", "none"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "report": {
        "id": "report_id",
        "status": "resolved",
        "resolvedBy": {
          "id": "admin_id",
          "username": "admin_username"
        },
        "resolution": {
          "action": "warning",
          "note": "User warned"
        },
        "resolvedAt": "2023-01-30T04:15:00Z"
      }
    }
  }
  ```

## 12. Shop API (Future)

### 12.1 Get Shop Items

- **URL**: `/api/shop/items`
- **Method**: `GET`
- **Auth**: Required
- **Query Parameters**:
  - `type`: Filter by item type
  - `currency`: Filter by currency type
  - Pagination parameters
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "items": [
        {
          "id": "item_id",
          "type": "profile",
          "name": "Premium Background",
          "description": "Exclusive background for your profile",
          "imageUrl": "https://example.com/item.jpg",
          "price": {
            "amount": 500,
            "currency": "virtual"
          },
          "rarity": "legendary",
          "availability": {
            "available": true,
            "startDate": "2023-01-01T00:00:00Z",
            "endDate": null
          }
        }
      ]
    },
    "meta": {
      "pagination": { /* pagination info */ }
    }
  }
  ```

### 12.2 Get User Inventory

- **URL**: `/api/shop/inventory`
- **Method**: `GET`
- **Auth**: Required
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "inventory": {
        "userId": "user_id",
        "items": [
          {
            "id": "inventory_item_id",
            "item": {
              "id": "item_id",
              "type": "profile",
              "name": "Premium Background",
              "imageUrl": "https://example.com/item.jpg"
            },
            "acquiredAt": "2023-01-15T00:00:00Z",
            "isEquipped": true,
            "equipLocation": "profile.background"
          }
        ]
      }
    }
  }
  ```

### 12.3 Equip Item

- **URL**: `/api/shop/inventory/equip`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "itemId": "inventory_item_id",
    "location": "profile.background"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "item": {
        "id": "inventory_item_id",
        "isEquipped": true,
        "equipLocation": "profile.background",
        "updatedAt": "2023-01-30T04:30:00Z"
      }
    }
  }
  ```

### 12.4 Unequip Item

- **URL**: `/api/shop/inventory/unequip`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "itemId": "inventory_item_id"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "item": {
        "id": "inventory_item_id",
        "isEquipped": false,
        "equipLocation": null,
        "updatedAt": "2023-01-30T04:35:00Z"
      }
    }
  }
  ```

### 12.5 Create Purchase (Virtual Currency)

- **URL**: `/api/shop/purchase`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "itemId": "item_id"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "transaction": {
        "id": "transaction_id",
        "item": {
          "id": "item_id",
          "name": "Premium Background"
        },
        "price": {
          "amount": 500,
          "currency": "virtual"
        },
        "status": "completed",
        "completedAt": "2023-01-30T04:40:00Z"
      },
      "inventory": {
        "id": "inventory_item_id",
        "acquiredAt": "2023-01-30T04:40:00Z"
      }
    }
  }
  ```

### 12.6 Create Payment Intent (Real Currency)

- **URL**: `/api/shop/payment`
- **Method**: `POST`
- **Auth**: Required
- **Request**:
  ```json
  {
    "itemId": "item_id"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "transaction": {
        "id": "transaction_id",
        "item": {
          "id": "item_id",
          "name": "Premium Background"
        },
        "price": {
          "amount": 5.99,
          "currency": "real"
        },
        "status": "pending",
        "paymentIntent": {
          "id": "payment_intent_id",
          "clientSecret": "client_secret"
        },
        "createdAt": "2023-01-30T04:45:00Z"
      }
    }
  }
  ```
