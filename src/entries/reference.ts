// The Logo language reference page: <logo-reference>. It needs only the
// reference, not the Logo engine.
import '../styles/reference.entry.css';
import { LogoReferenceElement } from '../reference/element.js';

if (!customElements.get('logo-reference')) customElements.define('logo-reference', LogoReferenceElement);
