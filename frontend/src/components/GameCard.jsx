import clsx from 'clsx';
import { getGameArt } from '../services/gameArt.js';

const GameCard = ({ game, onSelect, isActive = false, actionSlot }) => {
  const cover = getGameArt(game);
  const genres = (game?.genres || []).slice(0, 2).map((genre) => genre.name).join(' • ');

  return (
    <div className={clsx('game-card', isActive && 'game-card--active')}>
      <button type="button" className="game-card__media" onClick={onSelect}>
        <img src={cover} alt={game.name} loading="lazy" />
      </button>
      <div className="game-card__body">
        <div>
          <h3>{game.name}</h3>
          {genres && <p>{genres}</p>}
        </div>
        {actionSlot ? <div className="game-card__actions">{actionSlot}</div> : null}
      </div>
    </div>
  );
};

export default GameCard;
