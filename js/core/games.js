// Game registry. Every game lives in its own folder js/games/<id>/ and exports a default plugin object.
// To add a game: create the folder, add its id to GAME_IDS. To remove or roll one back: delete the folder or take its id out.
// A game that fails to load is skipped, so one broken game can never break the hub or the other games.
//
// Plugin contract (what a game's index.js default export looks like):
// {
//   id: 'kachuful', prefix: 'KF',            // prefix = 2 letters used at the start of room codes (KF-4821)
//   name: 'Kachuful', icon: '<svg…>', blurb: 'Bid and win tricks', tag: 'Score book',
//   minPlayers: 2, maxPlayers: 10,
//   setup: { html(cfg) -> string, read(root) -> config },     // extra options on the new-room screen
//   create({ players:[{name}], config }) -> state              // starting state (a plain JSON object)
//   summary(state) -> { title, line, rows:[{rank,name,total}], done }   // for the room list, history and share card
//   mount(root, ctx) -> { update(state), destroy() }           // draws the game. ctx below
// }
// ctx = { state, isHost, code, user, save(nextState), toast, shareCard(card), now() }
// A viewer gets the same mount() with isHost = false, so watch-only and host screens stay in step.

import { makeCode } from './util.js';
export const GAME_IDS = ['kachuful', 'teenpatti', 'kalitiri', 'rummy', 'bhabhi', 'scorebook'];

const cache = new Map();
const failed = new Map();

export async function loadGame(id) {
  if (cache.has(id)) return cache.get(id);
  try {
    const m = await import(`../games/${id}/index.js`);
    const g = m.default;
    if (!g || g.id !== id) throw new Error('Game file does not match its id');
    cache.set(id, g);
    return g;
  } catch (e) {
    failed.set(id, e);
    console.warn('Game "' + id + '" could not load and was skipped.', e);
    return null;
  }
}

export async function loadAllGames() {
  const list = await Promise.all(GAME_IDS.map(loadGame));
  return list.filter(Boolean);
}

export const loadErrors = () => failed;

// Room codes start with the game's 2-letter prefix, so a room only ever needs ITS game, not all six.
export const PREFIX_ID = { KF: 'kachuful', TP: 'teenpatti', KT: 'kalitiri', RM: 'rummy', BH: 'bhabhi', SB: 'scorebook' };
export async function gameForCode(code) {
  const prefix = String(code || '').slice(0, 2).toUpperCase();
  const id = PREFIX_ID[prefix];
  if (id) { const g = await loadGame(id); if (g && g.prefix === prefix) return g; }
  const all = await loadAllGames();   // unknown prefix: fall back to the slow way
  return all.find((g) => g.prefix === prefix) || null;
}
/** Warm the other games while the phone is idle, so opening any of them is instant. */
export function prefetchGames() {
  const go = () => GAME_IDS.forEach((id) => { loadGame(id); });
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 1200);
}

export function newCode(game) { return makeCode(game.prefix); }
