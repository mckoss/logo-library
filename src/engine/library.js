// The music player library (player.lgo), which every stage runs before a
// program, as the global string LOGO_LIBRARY (runtime.js reads it).
import library from '../library/player.lgo?raw';

self.LOGO_LIBRARY = library;
