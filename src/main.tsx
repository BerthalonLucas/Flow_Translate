import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { App } from './App';
import { bridge } from './bridge';
import './styles.css';
import './glass.css';

// The theme is posed before the first paint: the CSP forbids an inline script in index.html and the
// settings window has no backgroundColor, so it would otherwise flash light on its first showing.
//
// `data-theme` drives custom properties only, so every window can take it. `color-scheme` paints the
// WebView canvas, so it is posed for the settings window alone: `overlay` and `capsule` are
// transparent windows whose root nothing paints, and an opaque canvas would turn the overlay into a
// grey rectangle on the desktop. `index.html` keeps its `<meta name="color-scheme" content="light">`
// for exactly that reason. `src/lab/frame.tsx`, which never loads this file, applies the same rule.
const windowName = new URLSearchParams(location.search).get('window') ?? (bridge.native ? 'overlay' : 'demo');
const root = document.documentElement;
if (windowName === 'settings') {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    root.dataset.theme = dark.matches ? 'dark' : 'light';
    root.style.colorScheme = dark.matches ? 'dark' : 'light';
  };
  applyTheme();
  dark.addEventListener('change', applyTheme);
} else {
  root.dataset.theme = 'dark';
}

createRoot(document.getElementById('root')!).render(<StrictMode><MotionConfig reducedMotion="user"><App /></MotionConfig></StrictMode>);
