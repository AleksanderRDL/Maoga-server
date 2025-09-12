const express = require('express');
const chatController = require('../controllers/chatController');
const { validateRequest, validateParams, validateQuery } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiter');
const { sendMessageSchema, getChatHistoryQuerySchema } = require('../validations/chatValidation');
const Joi = require('joi');

const router = express.Router();

// All chat routes require authentication
router.use(authenticate);

// Send message to lobby chat
router.post(
  '/lobby/:lobbyId/messages',
  rateLimiter.standard,
  validateParams(
    Joi.object({
      lobbyId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
    })
  ),
  validateRequest(sendMessageSchema),
  chatController.sendLobbyMessage
);

// Get lobby chat history
router.get(
  '/lobby/:lobbyId/messages',
  rateLimiter.relaxed,
  validateParams(
    Joi.object({
      // Corrected: Wrapped in Joi.object()
      lobbyId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
    })
  ),
  validateQuery(getChatHistoryQuerySchema),
  chatController.getLobbyChatHistory
);

module.exports = router;
