import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function JoinRoom() {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomId.trim()) {
      alert('Please enter a Room ID before joining.');
      return;
    }
    navigate(`/room/${roomId.trim()}`);
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        (process.env.REACT_APP_SIGNALING_URL) + '/create-room'
      );
      if (!res.ok) throw new Error('Failed to create room');
      const j = await res.json();
      navigate(`/room/${j.roomId}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Could not create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-900 rounded-xl shadow-lg w-full max-w-md text-center relative z-10">
      <h2 className="text-2xl font-bold mb-4">Join or Create a Room</h2>

      <input
        className="p-2 rounded bg-gray-800 border border-gray-700 w-full mb-3 text-white"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter Room ID"
        disabled={loading}
      />

      <div className="flex gap-3 justify-center">
        <button
          className="neon-button"
          onClick={handleJoin}
          disabled={loading}
        >
          Join Room
        </button>

        <button
          className="neon-button"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>
      </div>
    </div>
  );
}
