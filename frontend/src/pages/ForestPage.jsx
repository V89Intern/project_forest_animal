import React, { useEffect, useRef, useState } from "react";

import { CinematicSpawnOverlay } from "../components/CinematicSpawnOverlay.jsx";
import { ForestAPI } from "../lib/api.js";
import { initializeForestScene } from "../lib/forestScene.js";

export function ForestPage() {
  const mountRef = useRef(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("System Active - Listening for Spawn");
  const [overlayAnimal, setOverlayAnimal] = useState(null);
  const [forestLoadError, setForestLoadError] = useState("");

  useEffect(() => {
    if (!mountRef.current) return undefined;
    let cleanup = null;
    try {
      cleanup = initializeForestScene({
        mountEl: mountRef.current,
        api: ForestAPI,
        onSpawnStart: (animal) => {
          setOverlayAnimal({
            ...animal,
            url: ForestAPI.assetUrl(animal.url)
          });
        },
        onSpawnEnd: () => setOverlayAnimal(null),
        onStatusChange: (text) => setStatus(text),
        onCountChange: (value) => setCount(value)
      });
    } catch (err) {
      const reason = err?.message || String(err);
      setForestLoadError(`Failed to load Three.js forest scene: ${reason}`);
    }

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {forestLoadError ? (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            padding: "10px 12px",
            background: "rgba(140,20,20,.85)",
            color: "#fff",
            zIndex: 100
          }}
        >
          {forestLoadError}
        </div>
      ) : null}

      <div id="ui-panel">
        <h1>Magic Forest V13</h1>
        <div className="back-link-wrap">
          <a href="/" className="back-link">
            Back
          </a>
        </div>
        <div className="stat-row">
          <span className="stat-label">Creatures Alive</span>
          <span id="animal-count" className="count">
            {String(count)}
          </span>
        </div>
        <div id="status-bar">
          <div className="pulse" />
          <span id="status-text">{status}</span>
        </div>
      </div>

      <CinematicSpawnOverlay animal={overlayAnimal} />
    </div>
  );
}
