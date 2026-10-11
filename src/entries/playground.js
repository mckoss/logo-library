// The Logo Playground page: <logo-playground>, with its reference.
import '../styles/playground.entry.css';
import { LogoPlaygroundElement } from '../playground/element.js';

if (!customElements.get('logo-playground')) customElements.define('logo-playground', LogoPlaygroundElement);
