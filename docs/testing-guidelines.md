# Testing Strategy and Plan

This documents the testing strategy/setup for the Maoga server.

## 1. Testing Objectives
### 1.1 Primary Objectives
- Ensure the platform functions correctly according to requirements
- Validate data integrity and system security
- Verify real-time features work reliably
- Ensure the system performs adequately under expected load
- Identify and eliminate defects early in the development cycle
- Support continuous integration and deployment processes
### 1.2 Quality Attributes to Test
- **Functionality**: Core features work as specified
- **Reliability**: System operates consistently without failures
- **Performance**: Response times are within acceptable limits
- **Security**: User data is protected, authorization works correctly
- **Scalability**: System handles increasing user loads
- **Usability**: APIs are intuitive and well-documented

## 2. Testing Levels
### 2.1 Unit Testing
Unit tests verify that individual components work correctly in isolation.
#### 2.1.1 Scope
- Individual functions and methods
- Service implementations
- Models and data validators
- Utility functions
#### 2.1.2 Tools and Technologies
- **Test Framework**: Mocha
- **Assertion Library**: Chai
- **Mocking Framework**: Sinon

### 2.2 Integration Testing
Integration tests verify that multiple components work correctly together.
#### 2.2.1 Scope
- API routes and controllers
- Database operations
- Authentication and authorization
- External service integrations
- Real-time communication
#### 2.2.2 Tools and Technologies
- **Test Framework**: Mocha
- **Assertion Library**: Chai
- **HTTP Client**: Supertest
- **Database**: MongoDB Memory Server

### 2.3 API Testing
API tests verify that API endpoints work correctly end-to-end.
#### 2.3.1 Scope
- Request validation
- Response format and status codes
- Error handling
- Authentication and authorization
- Rate limiting
- Data consistency
#### 2.3.2 Tools and Technologies
- **Framework**: Postman/Newman
- **Schema Validation**: Ajv
- **Automation**: Newman CLI for CI/CD

### 2.4 Socket.IO Testing
Socket.IO tests verify that real-time communication features work correctly.
#### 2.4.1 Scope
- Connection and authentication
- Event emissions and handling
- Room management
- Presence and status tracking
- Chat functionality
- Matchmaking status updates
- Error handling
#### 2.4.2 Tools and Technologies
- **Test Framework**: Mocha
- **Assertion Library**: Chai
- **Socket.IO Client**: socket.io-client
- **In-Memory Server**: http and Socket.IO server instances

### 2.5 Performance Testing
Performance tests verify that the system performs adequately under expected load.
#### 2.5.1 Scope
- Response time under load
- Throughput capabilities
- Concurrent user handling
- Resource utilization
- Scalability characteristics
- Real-time message handling capacity
#### 2.5.2 Tools and Technologies
- **Load Testing**: Artillery
- **Benchmarking**: Autocannon
- **Monitoring**: Node.js Clinic, Prometheus

### 2.6 Security Testing
Security tests verify that the system is secure against common vulnerabilities.
#### 2.6.1 Scope
- Authentication and authorization
- Input validation and sanitization
- Session management
- Rate limiting
- Data encryption
- API security
#### 2.6.2 Tools and Technologies
- **Static Analysis**: ESLint Security Plugin
- **Dependency Scanning**: npm audit
- **Security Testing Framework**: OWASP ZAP


## 3. Testing Infrastructure
### 3.1 Test Environment Setup
#### 3.1.1 Local Development Environment
**Thoughts/Considerations regarding Local Development Environment for Testing**:
* **Consistency**: Developers should be able to run all types of tests (unit, integration) easily on their local machines before pushing code.
* **Dependencies**:
* **MongoDB**: For integration tests, use an in-memory MongoDB server (like `mongodb-memory-server`) or a local MongoDB instance/Docker container dedicated for testing. This ensures tests are isolated and don't interfere with development data.
* **Redis**: If Redis is used, a local Redis instance/Docker container or an in-memory mock for unit tests.
* **Environment Variables**: Tests should run with a specific test configuration (e.g., `NODE_ENV=test`). Use a separate `.env.test` file or set environment variables in test scripts. This would point to test databases, use test API keys, etc.
* **Test Runner**: Configure `npm test` script in `package.json` to execute Mocha (or chosen test runner).
* **Ease of Use**: A single command should be able to run all relevant tests.
* **Speed**: Unit tests should be very fast. Integration tests will be slower but should still be manageable for local execution.
* **Coverage**: Tools like `nyc` (Istanbul) can be integrated to generate code coverage reports locally, helping developers see if their tests cover the codebase adequately.
* **Maoga Context**: Essential for developer productivity and catching bugs early. The choice of Mocha/Chai/Sinon is good. `mongodb-memory-server` is a great choice for integration tests needing MongoDB.

#### 3.1.2 Test Data Seeding
**Thoughts/Considerations regarding Test Data Seeding**:
* **Purpose**: To populate the test database with a known set of data before running integration or API tests. This ensures tests run in a predictable and consistent state.
* **When Needed**: For tests that rely on pre-existing data (e.g., testing fetching a specific user, testing login with an existing user, testing matchmaking with a pool of users).
* **Strategy**:
* **Fixture Files**: Define test data in reusable fixture files (e.g., JSON or JavaScript modules). Example in `test/fixtures/users.js`.
* **Programmatic Seeding**: Write helper functions or scripts that use your Mongoose models to insert this fixture data into the test database.
* **`beforeEach` / `beforeAll` Hooks**: In your test suites (e.g., using Mocha's hooks), call these seeding functions before tests run.
* **Data Cleanup**:
* Use `afterEach` or `afterAll` to clean up the seeded data (e.g., drop collections, delete specific documents) to ensure tests are isolated and don't affect each other.
* `mongodb-memory-server` often makes cleanup easier as the DB is torn down after tests.
* **Data Variation**: Create diverse test data to cover different scenarios, including edge cases.
* **Example (Conceptual)**:
```javascript
// test/fixtures/users.js
// const testUsers = [{ email: 'test@example.com', ... }];
// module.exports = testUsers;

        // test/helpers/seedDb.js
        // const User = require('../../src/modules/user/models/User');
        // const testUsers = require('../fixtures/users');
        // async function seedUsers() { await User.insertMany(testUsers); }
        // async function clearUsers() { await User.deleteMany({}); }

        // user.test.js
        // describe('/api/users', () => {
        //   beforeEach(async () => { await seedUsers(); });
        //   afterEach(async () => { await clearUsers(); });
        //   it('should get a user', ...);
        // });
   ```
    * **Maoga Context**: Will be important for testing user interactions, matchmaking, lobbies, etc., where specific data states are required.


### 3.2 Continuous Integration Setup
#### 3.2.1 GitHub Actions Workflow
**Thoughts/Considerations regarding GitHub Actions Workflow for Testing**:
* **Covered in `deployment-guide.md` (Section 4.1) and `implementation-guidelines.md` (Section 7.3.1)**.
* **Key Aspects for Testing Strategy**:
* **Triggers**: Run on pushes to `main`/`develop` and on all Pull Requests targeting these branches.
* **Matrix Testing (Optional)**: If you need to support multiple Node.js versions, test against them using a matrix strategy. (Likely not needed for Maoga initially)
* **Service Containers**: For integration/API tests, GitHub Actions can spin up service containers (e.g., MongoDB, Redis) that your application tests can connect to.
```yaml
# .github/workflows/ci.yml
# jobs:
#   test:
#     runs-on: ubuntu-latest
#     services:
#       mongo:
#         image: mongo:4.4 # Or your specific version
#         ports: ['27017:27017']
#     steps:
#       # ... checkout, setup node ...
#       - name: Run tests
#         env:
#           MONGODB_URI: mongodb://localhost:27017/maoga_test # Service container is on localhost
#         run: npm test
```
* **Test Reports**: Upload test reports (e.g., JUnit XML format) as artifacts for easier debugging of CI failures.
* **Coverage Reports**: Upload code coverage reports (e.g., LCOV format to services like Codecov or Coveralls) as artifacts.
* **Caching**: Cache `node_modules` to speed up builds.
* **Conditional Steps**: E.g., only run deployment steps if tests on a specific branch pass.
* **Maoga Context**: This is the backbone of your CI. Sprint 1 plans for this. Ensure it runs all levels of automated tests (unit, integration, API if Newman is used).

#### 3.2.2 Test Scripts Configuration
**Thoughts/Considerations regarding Test Scripts Configuration**:
* **`package.json` Scripts**: Define clear and consistent scripts for running tests.
* `"test"`: The main script, perhaps runs all unit and integration tests. (e.g., `mocha 'test/unit/**/*.test.js' 'test/integration/**/*.test.js'`)
* `"test:unit"`: Runs only unit tests.
* `"test:integration"`: Runs only integration tests.
* `"test:api"`: Runs API tests (e.g., using Newman for Postman collections).
* `"test:socket"`: Runs Socket.IO specific tests.
* `"test:coverage"`: Runs tests and generates a coverage report (e.g., `nyc npm test`).
* `"lint"`: Runs ESLint.
* `"format"`: Runs Prettier.
* **Environment Variables in Scripts**:
* Set `NODE_ENV=test` for test scripts.
* Use libraries like `cross-env` to ensure cross-platform compatibility for setting environment variables in scripts.
  (e.g., `"test": "cross-env NODE_ENV=test mocha --recursive test"`)
* **Test Runner Configuration (e.g., Mocha opts)**:
* Mocha options can be specified in `package.json`, a `.mocharc.js` file, or on the command line.
* Options include: test timeout, reporter, recursive file search, require setup files (`--require test/setup.js`).
* **Code Coverage Configuration (e.g., `nyc` or Jest config)**:
* Specify which files to include/exclude from coverage.
* Set coverage thresholds (e.g., fail the build if coverage drops below X%). (Not critical for MVP, but good for later)
* **Maoga Context**: Having granular test scripts in `package.json` makes it easy for developers and CI to run specific types of tests.


## 4. Test Data Management
### 4.1 Test Fixtures
**Thoughts/Considerations regarding Test Fixtures**:
* **Location**: `test/fixtures/` directory, as planned in `project-structure.md`.
* **Purpose**: To provide reusable, predefined sets of data for tests. This makes tests more readable, maintainable, and consistent.
* **Format**:
* JavaScript modules (`.js`): Allow for dynamic data generation or functions to create variations of fixtures.
* JSON files (`.json`): Simple for static data.
* **Content for Maoga**:
* `users.js`: Arrays of user objects (e.g., standard user, admin user, user with specific preferences, user with friends).
* `games.js`: Game objects (e.g., for testing game listings, matchmaking with specific games).
* `matchRequests.js`: Sample matchmaking request criteria.
* `lobbies.js`: Predefined lobby states.
* `auth.js`: Test credentials, JWT payloads.
* **Organization**: Subdirectories within `test/fixtures/` if you have many fixtures (e.g., `test/fixtures/users/`, `test/fixtures/games/`).
* **Usage**: Import these fixtures into your test files or seeding scripts.
* **Best Practices**:
* Keep fixtures focused and relevant to the tests they support.
* Avoid overly large or complex fixtures if simpler ones suffice.
* Ensure fixture data is valid according to your Mongoose schemas and validation rules.
* Give fixtures descriptive names or properties.
* **Maoga Context**: Essential for creating realistic test scenarios for your application's core features.

### 4.2 Test Helpers
**Thoughts/Considerations regarding Test Helpers**:
* **Location**: `test/utils/` or `test/helpers/` directory, as planned (`test/utils/testHelpers.js`, `test/utils/socketClient.js`).
* **Purpose**: To encapsulate common setup, teardown, or utility logic used across multiple test files. This reduces code duplication in tests and makes them cleaner.
* **Examples of Helpers for Maoga**:
* **Database Helpers**:
* `connectTestDb()`: Connects to the test database.
* `disconnectTestDb()`: Disconnects from the test database.
* `clearDb()`: Clears all collections in the test database.
* `seedCollection(collectionName, data)`: Seeds a specific collection.
* **Authentication Helpers**:
* `generateTestToken(userPayload)`: Creates a JWT for a test user.
* `getAuthenticatedRequest(userRole = 'user')`: Returns an instance of `supertest` agent that is pre-authenticated with a test token for a given role.
* **API Request Helpers (using Supertest)**:
* Wrapper functions for common GET, POST, PUT, DELETE requests that might include authentication headers by default.
* **Socket.IO Client Helper**: (As discussed in `real-time-communication.md` section 8.1) Functions to connect, authenticate, emit, and listen for Socket.IO events.
* **Fixture Generation Helpers**: Functions to create customized fixture data if needed (e.g., `createTestUser({ role: 'admin' })`).
* **Mocking Helpers**: Functions to easily set up common mocks (e.g., mocking external API calls).
* **Setup File (`test/setupTestEnv.js` or similar)**: A global setup file (e.g., required by Mocha via `--require`) can use these helpers to prepare the test environment before any tests run (e.g., connect to DB).
* **Maoga Context**: Crucial for writing maintainable and DRY (Don't Repeat Yourself) tests.