import React from 'react';

export default function Home({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black text-white font-sans">
      <h1 className="text-5xl font-bold mb-8 text-neonPink drop-shadow-[0_0_15px_#ff2d95]">
        🚀 File-share (P2P)
      </h1>
      <button
        onClick={onStart}
        className="px-8 py-4 bg-neonBlue text-black font-bold rounded-md shadow-neonBlue hover:scale-105 transition transform duration-200"
      >
        Get Started
      </button>
    </div>
  );
}
