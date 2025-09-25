import apexLegends from '../assets/games/apex-legends.svg';
import amongUs from '../assets/games/among-us.svg';
import baldursGate3 from '../assets/games/baldurs-gate-3.svg';
import borderlands2 from '../assets/games/borderlands-2.svg';
import deadByDaylight from '../assets/games/dead-by-daylight.svg';
import defaultGame from '../assets/games/default-game.svg';
import diablo from '../assets/games/diablo.svg';
import itTakesTwo from '../assets/games/it-takes-two.svg';
import leagueOfLegends from '../assets/games/league-of-legends.svg';
import minecraft from '../assets/games/minecraft.svg';
import pokemon from '../assets/games/pokemon.svg';
import tetris from '../assets/games/tetris.svg';
import valorant from '../assets/games/valorant.svg';

const normaliseKey = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');

const artMap = new Map([
  ['league-of-legends', leagueOfLegends],
  ['lol', leagueOfLegends],
  ['tetris', tetris],
  ['minecraft', minecraft],
  ['diablo', diablo],
  ['diablo-4', diablo],
  ['diablo-iv', diablo],
  ['borderlands-2', borderlands2],
  ['borderlands2', borderlands2],
  ['among-us', amongUs],
  ['baldurs-gate-3', baldursGate3],
  ['baldur-s-gate-iii', baldursGate3],
  ['it-takes-two', itTakesTwo],
  ['apex-legends', apexLegends],
  ['pokemon', pokemon],
  ['pok-mon', pokemon],
  ['dead-by-daylight', deadByDaylight],
  ['valorant', valorant]
]);

export const getGameArt = (game = {}) => {
  if (game.coverImage?.url || game.coverImage?.thumbnailUrl) {
    return game.coverImage.url || game.coverImage.thumbnailUrl;
  }

  const slugKey = game.slug ? normaliseKey(game.slug) : null;
  if (slugKey && artMap.has(slugKey)) {
    return artMap.get(slugKey);
  }

  if (game.name) {
    const nameKey = normaliseKey(game.name);
    for (const [key, image] of artMap.entries()) {
      if (nameKey.includes(key) || key.includes(nameKey)) {
        return image;
      }
    }
  }

  return defaultGame;
};

export default getGameArt;
