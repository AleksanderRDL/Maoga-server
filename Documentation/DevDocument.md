# Development document
## Overall idea behind the mvp/project
I am creating a server which will serve as the backend for my mobile app and web-app-based frontend. They will manage gamers looking to match for someone to play with. 
So based on your profile attributes (location, playstyle, etc.) and inputting the desired games, the competitiveness of your gamestyle, etc. It will start a search which will try and match you with others fitting the parameters as best as possible. We want to entice players to meet each other and stay connected in the app, think of it as a bit of a mix between discord and an app like tinder.

## Elevator pitch
The rise in gaming popularity has opened new avenues for social interactions and community building through virtual platforms. However, despite the inclusive potential of gaming, female gamers often find it challenging to locate other female gamers in a male-dominated environment. This app aims to create a safe and welcoming space where female gamers can connect, team up, and enjoy gaming together, fostering a supportive community.

--------------------------
## Context of the backend (Scope, hosting method)
The backend should be able to service a small number of users, as we are a startup and do not have a huge number of users awaiting our product. Scaling can be considered later.
The hosting/deployment of the server will firstly be run on our local hardware as we test and iterate. Ideally, it should be designed in a way that makes cloud hosting of the backend easy later on.
Some features such as payment/the shop, extensive app exploration/dashboard features, rich media in chat, a such non-crucial part of the core loop for our users, do not have to be fully implemented in the first version of the mvp, however, it should be accommodated/thought into the overall architecture/implementation.

--------------------------
## Features breakdown (What overall services should the backend be able to provide)
it is not an exhaustive list of specific APIs/services the backend should provide but an overall view of key user flows which the backend should be comfortable at providing
### User-related features 
- Standard user
- Admin user roles (view users, ban user, manage reported content)
- User profile management (account management/settings etc.)
- User customization (decorating profile, choosing publicity to other users, etc.)
- Friend list and chats with friends
- User selected games (The games the user plays, with info about their rank, their in game name, etc)
- User communication/media platforms (where else you can find the user)
- User karma points (karma points indicate whether another gamer enjoyed interacting with you)
- User history/activity
- User bio/status to be displayed in profile

### Matchmaking-related features
- Preferences-based matching algorithm
- Support for searching for a list of multiple games simultaneously (with possible weight on preferred games)
- Flexible player requirements (can search for 1-X number of other players at one time)
- Start with most preferred options, wait a certain threshold, then go ahead with the next most preferred (users can choose two options equally preferred as well)
- Fallback options if an optimal query is not possible (go ahead with fewer players? Provide notification when search might be better, etc.)
- Creation of a lobby as players are matched (start a lobby when at least two players have been matched and add players until requirements are met)
- Skill and competitiveness based matching (try and pair players according to their skill rating or desired play style (casual, ranked, etc.))
- Region- and/or language-based matching
- Chose between real-time matchmaking and planned matchmaking (as our user base will start small, it is important to be able to que for matches which might take time and not be guaranteed the users can immediately play when matched. But they might provide info of when they would be available)
- Go into matchmaking with some number of pre-added friends
- Cancel or change matchmaking when queuing
- Notify the user when a minimum match has been found and a lobby has been created

### Lobby-related features
- A lobby is created and persists after a match is created
- Can be left by a user if they no longer desire to be in it
- In lobby chat between members of a lobby
- Support for emojis, GIF, and pictures 
- Lobby members' profiles should be displayed and be able to showcase their in-game names, rank, karma-points, chosen media (e.g., discord) and possible profile customizations
- Be able to enter the page of other members' user profiles and add each other if they desire
- Notify the user when a lobby is fully populated or other relevant events.
- Automated lobby message (e.g., Something that automatically displays when a user joins a lobby but is not currently present, could be chosen when going into the matchmaking)

### Alert-related features
- Configurable notification preferences
- In-app notifications
- Out-of-app notifications
- Notifications using device tokens 
- Matchmaking-related notifications
- Lobby-related notifications
- User-and-friend-related notifications
- Event-and-shop-related notifications

### Shop-related features
- Be able to customize the profile by unlocking items/layouts via a store in the app
- Access potential locked features of the app through the store

### App exploration/dashboard-related features
- Dashboard/timeline of friend updates (friends achieved new rank in game? posts/images published etc.)
- Overview of popular(or niche) games the users on the platform engage in 
- Generally interesting statistics related to our platform the user might want to explore
- Game updates or news for games a user is interested in

### General/uncategorized features
- Game indexing (have a list of games to choose available fetched from an exhaustive game database) (an external API (like IGDB, RAWG))
- Integration with a payment platform (enable us to sell stuff for actual money) 

--------------------------
## Backend and UI collaboration
### UI Status
We have designs and ui of many elements regarding the frontend of our application. However, it is still a prototype, so it can adapt based on requirements from the backend as well

### Necessary API endpoints for the UI
The backend should focus on providing the core services needed for the users to participate in the core business logic of our idea. Smaller features and further functionality often native to an app like ours should be thought into the architecture as we want the application to be able to grow with user feedback and the roadmap
For real-time features (like chat integrating) socket connection between the backend and frontend might be useful? (i'm not quite sure)


--------------------------
## Architecture and code format
### High-level architecture and internal layers
Our overall architecture will be a Modular Monolith. All components live in one codebase, making it simpler to develop, test, and deploy. The application should be divided into logical modules (e.g., User, Matchmaking, Chat, etc.).
#### Presentation Layer (Handles incoming HTTP requests and WebSocket connections)
The route files in each module form the presentation layer. They route requests to the relevant logic. src/app.js ties these routes together and starts the server. It consists of Express routes and Socket.IO event listeners.
#### Modules Layer
Each module encapsulates logic related to its domain. In these modules, there are controllers that process requests and events (e.g., user registration, matching logic) and their necessary helper functions.
#### Database Layer
MongoDB serves as the persistent storage.
#### Data Access Layer
Implemented by the Mongoose models (viewed under model folders). They abstract direct interactions with MongoDB, allowing a higher-level API for querying and updating data.

### Tech stack
- **Runtime Environment:** Node.js
- **Database:** MongoDB
- **Express.js** for handling HTTP requests and middleware.

### Libraries/Tools
- **Database:**
    - **Mongoose:** For MongoDB schema management and connections.
    - *(Optionally, Redis for caching and session management)*

- **Core Logic & Communication:**
    - **Socket.IO:** For real-time chat functionality.
    - *(Additional libraries for tasks such as geolocation or data validation as needed)*

- **Authentication:**
    - **JWT:** For stateless authentication.
    - **OAuth 2.0:** For external logins (Google, Discord, etc.).

- **Testing:**
    - **Mocha**
    - **Chai**
    - **CI/CD:** GitHub Actions.

- **Logging & Monitoring:**
    - **Morgan**

### Overall architecture guidelines
- I want to keep the modular monolith clean so that it can grow with the application
- Defined and protected module boundaries
- Separate data and API
- Domain events for side effects
- Guardrails in the CI/CD pipeline
- Always strive to use versions and combinations in the tech stack which are well-documented and long-term stable (no breaking changes)
    
### Low-level architecture
We need to have a defined guideline/documentation for the low-level architecture which consists of the modules in the monolith itself.
This is to ensure we have an overall view of the modules:
- Call/flow relationships
- Interfaces and APIs
- Data model and persistence
- Error handling
- Observability hooks

--------------------------
## Testing and development practices
- Unit tests for each module.
- Integration/system testing
- Use a basic CI / CD pipeline (GitHub actions)

--------------------------
## Must include considerations
### Data Privacy (GDPR Compliance)
- Ensure all personal data is managed and stored in compliance with GDPR and other relevant data protection regulations.

### Security
- HTTPS/TLS.
- Input validation, sanitization, and rate limiting.
- Encrypt sensitive data both in transit and at rest (MongoDB’s built-in capabilities!).

### Error management
- Consistent error handling
- Logging

--------------------------
## Implementation plan with tracking and timeline
A roadmap of features should be created. It should be a mix of logic steps for features that require each other and general stuff to be implemented.
Important/core features should furthermore have a general timeline of reasonable implementation


--------------------------
## Long-term goals/possibilities (Not a priority as of now)
### DevOps & Deployment
- Docker to ensure consistent environments across development, testing, and production.
- Extensive/complex CI/CD Pipeline and structure for implementation of features, refactors and bugfixes

### Scalability
- Possibly extraction of individual modules later.
- Redis caching to improve response times.
- Database indexing and potential sharding as the user load increases.