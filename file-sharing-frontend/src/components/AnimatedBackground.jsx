// AnimatedBackground.jsx
import React from "react";
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";

export default function AnimatedBackground() {
  const particlesInit = async (engine) => {
    await loadFull(engine);
  };

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1, // <-- keeps it behind
      }}
      options={{
        background: { color: "#0d1117" },
        particles: {
          number: { value: 80 },
          color: { value: "#ff2d95" },
          links: { enable: true, color: "#ff2d95" },
          move: { enable: true, speed: 2 },
        },
      }}
    />
  );
}
