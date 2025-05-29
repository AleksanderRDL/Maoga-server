const Joi = require('joi');

const lobbyIdParamSchema = Joi.object({
  lobbyId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid lobby ID format'
    })
});

const joinLobbySchema = Joi.object({
  // Can be extended with password for private lobbies
});

const setReadySchema = Joi.object({
  ready: Joi.boolean().default(true)
});

const getUserLobbiesQuerySchema = Joi.object({
  includeHistory: Joi.boolean().default(false)
});

module.exports = {
  lobbyIdParamSchema,
  joinLobbySchema,
  setReadySchema,
  getUserLobbiesQuerySchema
};
