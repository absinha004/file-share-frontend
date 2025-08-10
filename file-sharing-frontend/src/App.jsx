import React, { useState } from 'react';
import Room from './components/Room';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, Arial' }}>
      {!joined ? (
        <div>
          <h1>File-share (P2P)</h1>
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" />
          <button style={{ marginLeft: 8 }} onClick={() => setJoined(true)}>Join</button>
          <p style={{ marginTop: 12 }}>Or <a href="#" onClick={async (e) => {
            e.preventDefault();
            const url = (import.meta.env.VITE_SIGNALING_URL || 'http://localhost:5000') + '/create-room';
            const res = await fetch(url);
            const j = await res.json();
            setRoomId(j.roomId);
            setJoined(true);
          }}>create a room</a>.</p>
        </div>
      ) : (
        <Room roomId={roomId} />
      )}
    </div>
  );
}
