import { Game } from './game';

const app = document.getElementById('app');
const ui = document.getElementById('ui');
if (!app || !ui) throw new Error('Missing #app or #ui');
new Game(app, ui).start();
