import { Game } from './Game';

const container = document.getElementById('app');
if (!container) throw new Error('No #app container found');

new Game(container);
