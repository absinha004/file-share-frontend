import React, { useState } from 'react';
import Room from './components/Room';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black text-white font-sans">
      {!joined ? (
        <div className="bg-gray-900 p-8 rounded-lg shadow-neonBlue w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-neonPink drop-shadow-[0_0_10px_#ff2d95] text-center">
            🚀 File-share (P2P)
          </h1>

          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
            className="w-full p-3 rounded-md bg-black border border-gray-700 text-white focus:outline-none focus:border-neonPink mb-4"
          />

          <div className="flex justify-between">
            <button
              onClick={() => setJoined(true)}
              className="flex-1 mr-2 px-4 py-2 bg-neonBlue text-black font-bold rounded-md shadow-neonBlue hover:scale-105 transition"
            >
              Join
            </button>

            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                const url =
                  (import.meta.env.VITE_SIGNALING_URL || 'http://localhost:5000') +
                  '/create-room';
                const res = await fetch(url);
                const j = await res.json();
                setRoomId(j.roomId);
                setJoined(true);
              }}
              className="flex-1 ml-2 px-4 py-2 bg-neonPink text-white font-bold rounded-md shadow-neon hover:scale-105 transition text-center"
            >
              Create Room
            </a>
          </div>
        </div>
      ) : (
        <Room roomId={roomId} />
      )}
    </div>
  );
}
