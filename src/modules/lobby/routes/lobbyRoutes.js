const express = require('express');
const lobbyController = require('../controllers/lobbyController');
const { validateRequest, validateParams, validateQuery } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const {
  lobbyIdParamSchema,
  joinLobbySchema,
  setReadySchema,
  getUserLobbiesQuerySchema
} = require('../validations/lobbyValidation');

const router = express.Router();

// All lobby routes require authentication
router.use(authenticate);

// Get user's lobbies
router.get(
  '/',
  rateLimiter.standard,
  validateQuery(getUserLobbiesQuerySchema),
  lobbyController.getUserLobbies
);

// Get specific lobby
router.get(
  '/:lobbyId',
  rateLimiter.standard,
  validateParams(lobbyIdParamSchema),
  lobbyController.getLobby
);

// Join lobby
router.post(
  '/:lobbyId/join',
  rateLimiter.standard,
  validateParams(lobbyIdParamSchema),
  validateRequest(joinLobbySchema),
  lobbyController.joinLobby
);

// Leave lobby
router.post(
  '/:lobbyId/leave',
  rateLimiter.standard,
  validateParams(lobbyIdParamSchema),
  lobbyController.leaveLobby
);

// Set ready status
router.post(
  '/:lobbyId/ready',
  rateLimiter.standard,
  validateParams(lobbyIdParamSchema),
  validateRequest(setReadySchema),
  lobbyController.setReady
);

module.exports = router;
