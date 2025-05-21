# API Specifications
This document documents the API endpoints available at the Maoga server. As sprints get delivered, this document will be updated

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
    "data": { "responseData": "example values here" },
    "message": "Optional message",
    "meta": {
      "pagination": { "page": 1, "totalPages": 10 }
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
      "details": { "additionalInfo": "error details here" }
    }
  }
  ```
### 1.2 Authentication

### 1.3 Pagination


## 2. Auth API

## 3. User API

## 4. Friend API

## 5. Game API

## 6. Matchmaking API

## 7. Lobby API

## 8. Chat API

## 9. Notification API


## 10. WebSocket API
### 10.1 Connection
### 10.2 Events
#### 10.2.1 Client to Server Events
#### 10.2.2 Server to Client Events


## 11. Admin API (Future)


## 12. Shop API (Future)
