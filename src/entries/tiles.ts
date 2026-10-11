// The Turtle Tiles page: <turtle-tiles>.
import '../styles/tiles.entry.css';
import { TurtleTiles } from '../tiles/element.js';

if (!customElements.get('turtle-tiles')) customElements.define('turtle-tiles', TurtleTiles);
