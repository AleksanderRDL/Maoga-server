const chatService = require('../services/chatService');
const asyncHandler = require('../../../utils/asyncHandler');

const sendLobbyMessage = asyncHandler(async (req, res) => {
  const { lobbyId } = req.params;
  const { content, contentType = 'text' } = req.body;
  const userId = req.user.id;

  const message = await chatService.sendLobbyMessage(lobbyId, userId, content, contentType);

  res.status(201).json({
    status: 'success',
    data: { message }
  });
});

const getLobbyChatHistory = asyncHandler(async (req, res) => {
  const { lobbyId } = req.params;
  const { limit = 50, before } = req.query;
  const userId = req.user.id;

  const result = await chatService.getLobbyChatHistory(lobbyId, userId, {
    limit: parseInt(limit, 10),
    before
  });

  res.status(200).json({
    status: 'success',
    data: result
  });
});

module.exports = {
  sendLobbyMessage,
  getLobbyChatHistory
};
