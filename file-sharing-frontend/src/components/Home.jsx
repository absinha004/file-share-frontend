import React from 'react';
import './neon.css';

export default function Home({ onStart }) {
  return (
    <div className="relative w-full text-center z-10 px-6">
      <h1 className="neon-title mb-4">🚀 File-share (P2P)</h1>
      <p className="max-w-xl mx-auto text-lg mb-8 text-gray-300">
        Share files instantly and securely with your friends — no servers, no storage,
        just pure peer-to-peer magic. 🔗⚡
      </p>
      <button onClick={onStart} className="neon-button">
        Get Started
      </button>
    </div>
  );
}
