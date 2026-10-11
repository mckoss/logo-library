// Lesson pages: <logo-example> and <logo-worksheet>, with tooltips on their
// code.
import '../styles/lessons.entry.css';
import { LogoExample, LogoWorksheet } from '../lessons/elements.js';

if (!customElements.get('logo-example')) customElements.define('logo-example', LogoExample);
if (!customElements.get('logo-worksheet')) customElements.define('logo-worksheet', LogoWorksheet);
