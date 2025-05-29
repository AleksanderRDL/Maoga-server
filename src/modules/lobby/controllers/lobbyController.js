const lobbyService = require('../services/lobbyService');
const asyncHandler = require('../../../utils/asyncHandler');

const getLobby = asyncHandler(async (req, res) => {
  const { lobbyId } = req.params;
  const userId = req.user.id;

  const lobby = await lobbyService.getLobbyById(lobbyId, userId);

  res.status(200).json({
    status: 'success',
    data: { lobby }
  });
});

const joinLobby = asyncHandler(async (req, res) => {
  const { lobbyId } = req.params;
  const userId = req.user.id;

  const lobby = await lobbyService.joinLobby(lobbyId, userId);

  res.status(200).json({
    status: 'success',
    data: {
      lobby,
      message: 'Successfully joined lobby'
    }
  });
});

const leaveLobby = asyncHandler(async (req, res) => {
  const { lobbyId } = req.params;
  const userId = req.user.id;

  const lobby = await lobbyService.leaveLobby(lobbyId, userId);

  res.status(200).json({
    status: 'success',
    data: {
      lobby,
      message: 'Successfully left lobby'
    }
  });
});

const setReady = asyncHandler(async (req, res) => {
  const { lobbyId } = req.params;
  const { ready = true } = req.body;
  const userId = req.user.id;

  const lobby = await lobbyService.setMemberReady(lobbyId, userId, ready);

  res.status(200).json({
    status: 'success',
    data: {
      lobby,
      message: ready ? 'Marked as ready' : 'Marked as not ready'
    }
  });
});

const getUserLobbies = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { includeHistory = false } = req.query;

  const lobbies = await lobbyService.getUserLobbies(userId, {
    includeHistory: includeHistory === 'true'
  });

  res.status(200).json({
    status: 'success',
    data: { lobbies }
  });
});

module.exports = {
  getLobby,
  joinLobby,
  leaveLobby,
  setReady,
  getUserLobbies
};
