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
        <stop stopColor="#fff8e7" />
        <stop offset="0.7" stopColor="#ffe6ba" />
        <stop offset="1" stopColor="#ffd285" />
      </linearGradient>
      <filter id="eggGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* Base Egg Shape */}
    <path 
      d="M50 0C25 0 5 40 5 80C5 110 25 130 50 130C75 130 95 110 95 80C95 40 75 0 50 0Z" 
      fill="url(#eggGrad)" 
      filter="url(#eggGlow)"
    />
    
    {/* Decorative Spots/Patterns */}
    <circle cx="30" cy="90" r="8" fill="#ffffff" opacity="0.6" />
    <circle cx="70" cy="75" r="12" fill="#ffffff" opacity="0.4" />
    <circle cx="50" cy="110" r="6" fill="#ffffff" opacity="0.5" />
    <ellipse cx="40" cy="40" rx="10" ry="15" fill="#ffffff" opacity="0.3" transform="rotate(-20 40 40)" />
    
    {/* Cracks (hidden initially, appears during the end of the shake) */}
    <path className="egg-crack" d="M30 130 Q40 100 50 90 T40 60 T60 40" stroke="#ffd285" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0" />
  </svg>
);

export function CinematicSpawnOverlay({ animal }) {
  const [phase, setPhase] = useState("idle"); // 'idle', 'egg', 'flash', 'reveal'

  useEffect(() => {
    if (animal) {
      setPhase("egg");
      
      // The entire cinematic overlay is rendered for exactly 3000ms by forestScene.js
      // 0ms - 1800ms: Egg shaking and cracking
      // 1800ms - 2000ms: Flash overlay
      // 2000ms - 3000ms: Reveal the animal
      
      const flashTimer = setTimeout(() => {
        setPhase("flash");
      }, 1800);
      
      const revealTimer = setTimeout(() => {
        setPhase("reveal");
      }, 2000);

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
