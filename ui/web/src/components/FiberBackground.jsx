import { useState } from 'react';
import GhostFibers from './GhostFibers.jsx';

// Same rule as styles.css: html[data-theme] wins, else the system theme.
// ponytail: read once on mount; add a listener if the theme can change while these pages are open.
const isLight = () => {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === 'light' : !window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};

export default function FiberBackground() {
  const [light] = useState(isLight);
  return (
    <GhostFibers
      className="fiber-bg"
      lightMode={light}
      glowColor="#2f6bff"
      lineColor="#dff4ff"
      secondaryColor="#22d3ee"
      gradient="along"
      layers={2}
      twist={0.5}
      threads={96}
      fiberStyle="lines"
      depthOfField={1.1}
      hoverEffect="focus"
      waves={0.8}
      volume={0.5}
      tips={1}
      foldGlow={0.3}
      flow={0.25}
      sparkle={0.3}
      brightness={0.7}
      glow={0.5}
    />
  );
}
