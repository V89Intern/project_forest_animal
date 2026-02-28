import React, { useState, useEffect } from "react";
import "../styles/spawn.css";

const MagicalEgg = () => (
  <svg 
    className="magical-egg" 
    viewBox="0 0 100 130" 
    width="160" 
    height="208"
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="eggGrad" x1="50" y1="0" x2="50" y2="130" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#966d48" />
        <stop offset="0.6" stopColor="#5f3e23" />
        <stop offset="1" stopColor="#301e0f" />
      </linearGradient>
      <filter id="eggGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComponentTransfer in="blur" result="glow">
          <feFuncA type="linear" slope="2" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    
    {/* Base Egg Shape */}
    <path 
      d="M50 0C25 0 5 40 5 80C5 110 25 130 50 130C75 130 95 110 95 80C95 40 75 0 50 0Z" 
      fill="url(#eggGrad)" 
    />
    
    {/* Decorative Darker "Scales/Spots" for Texture */}
    <path d="M15 60 Q 20 65 15 70" stroke="#3d2613" strokeWidth="2" fill="none" />
    <path d="M30 40 Q 35 45 30 50" stroke="#3d2613" strokeWidth="2" fill="none" />
    <path d="M70 50 Q 65 55 70 60" stroke="#3d2613" strokeWidth="2" fill="none" />
    <path d="M85 80 Q 80 85 85 90" stroke="#3d2613" strokeWidth="2" fill="none" />
    <path d="M40 90 Q 45 95 40 100" stroke="#1f1207" strokeWidth="2" fill="none" />
    <path d="M60 85 Q 65 90 60 95" stroke="#1f1207" strokeWidth="2" fill="none" />
    <path d="M25 100 Q 30 105 25 110" stroke="#1f1207" strokeWidth="2" fill="none" />
    <path d="M75 105 Q 80 110 75 115" stroke="#1f1207" strokeWidth="2" fill="none" />

    {/* Intricate Branching Cracks (Glowing Yellow) */}
    <path className="egg-crack" 
      d="
        M 10 50 L 22 55 L 28 48 L 40 58 L 48 50 L 58 58 L 68 48 L 82 55 L 92 48 
        M 22 55 L 20 70 L 28 85 
        M 40 58 L 35 75 L 45 90 L 40 105
        M 58 58 L 62 75 L 55 90 L 60 105
        M 82 55 L 85 70 L 78 85
        M 48 50 L 50 40 
        M 28 48 L 30 35
        M 68 48 L 65 35
      " 
      stroke="#ffe770" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="miter" fill="none" opacity="0" 
      filter="url(#eggGlow)"
    />
    <path className="egg-crack-core" 
      d="
        M 10 50 L 22 55 L 28 48 L 40 58 L 48 50 L 58 58 L 68 48 L 82 55 L 92 48 
        M 22 55 L 20 70 L 28 85 
        M 40 58 L 35 75 L 45 90 L 40 105
        M 58 58 L 62 75 L 55 90 L 60 105
        M 82 55 L 85 70 L 78 85
      " 
      stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="miter" fill="none" opacity="0" 
    />
  </svg>
);

export function CinematicSpawnOverlay({ animal }) {
  const [phase, setPhase] = useState("idle"); // 'idle', 'egg', 'flash', 'reveal'

  useEffect(() => {
    if (animal) {
      setPhase("egg");
      
      // The entire cinematic overlay is rendered for exactly 6200ms by forestScene.js
      // 0ms - 5000ms: Egg shaking, glowing, and cracking
      // 5000ms - 5200ms: Flash overlay
      // 5200ms - 6200ms: Reveal the animal
      
      const flashTimer = setTimeout(() => {
        setPhase("flash");
      }, 5000);
      
      const revealTimer = setTimeout(() => {
        setPhase("reveal");
      }, 5200);

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(revealTimer);
      };
    } else {
      setPhase("idle");
    }
  }, [animal]);

  if (!animal || phase === "idle") return null;

  return (
    <div id="spawn-overlay" className={`phase-${phase}`}>
      {phase === "egg" && (
        <div className="egg-container">
          <MagicalEgg />
        </div>
      )}
      
      {phase === "flash" && (
        <div className="flash-overlay"></div>
      )}
      
      {phase === "reveal" && (
        <img id="spawn-overlay-image" alt="Cinematic Spawn" src={`${animal.url}?t=${Date.now()}`} />
      )}
      
      {/* Magic Particles */}
      <div className="magic-particles">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="particle" style={{ '--i': i }} />
        ))}
      </div>
    </div>
  );
}
