import React from "react";

export function CinematicSpawnOverlay({ animal }) {
  if (!animal) return null;
  return (
    <div id="spawn-overlay" style={{ display: "flex" }}>
      <img id="spawn-overlay-image" alt="Cinematic Spawn" src={`${animal.url}?t=${Date.now()}`} />
    </div>
  );
}
