import React, { useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './components/Home';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';
import AnimatedBackground from './components/AnimatedBackground';

export default function App() {
  const joinRef = useRef(null);
  const location = useLocation();
  const showBackground = !location.pathname.startsWith('/room/');

  const scrollToJoin = () => {
    joinRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen text-white font-sans overflow-x-hidden">
      {showBackground && <AnimatedBackground />}

      <Routes>
        {/* Main landing page */}
        <Route
          path="/"
          element={
            <>
              {/* Section 1: Home */}
              <section className="min-h-screen flex items-center justify-center">
                <Home onStart={scrollToJoin} />
              </section>

              {/* Section 2: Join/Create Room */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <section
                  ref={joinRef}
                  className="min-h-screen flex items-center justify-center"
                >
                  <JoinRoom />
                </section>
              </div>
            </>
          }
        />

        {/* Room page */}
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </div>
  );
}
