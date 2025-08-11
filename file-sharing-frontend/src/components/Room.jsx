import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const signalingServer = process.env.REACT_APP_SIGNALING_URL || 'http://localhost:5000';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);

  const [status, setStatus] = useState('Connecting...');
  const [messages, setMessages] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');
  const [fileProgress, setFileProgress] = useState(0);

  const incomingFileName = useRef('');
  const incomingFileSize = useRef(0);
  const receivedBuffers = useRef([]);
  const receivedSize = useRef(0);

  const createPeerConnection = useCallback((initiator, targetId) => {
    pcRef.current = new RTCPeerConnection();

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && targetId) {
        socketRef.current.emit('signal', {
          to: targetId,
          data: { candidate: event.candidate },
        });
      }
    };

    if (initiator) {
      dataChannelRef.current = pcRef.current.createDataChannel('fileChannel');
      setupDataChannel();
      pcRef.current.createOffer().then((offer) => {
        pcRef.current.setLocalDescription(offer);
        socketRef.current.emit('signal', { to: targetId, data: offer });
      });
    } else {
      pcRef.current.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        setupDataChannel();
      };
    }
  }, []);

  const setupDataChannel = () => {
    dataChannelRef.current.onopen = () => {
      setStatus('Connected');
    };

    dataChannelRef.current.onmessage = (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('FILE_META:')) {
        const meta = JSON.parse(event.data.replace('FILE_META:', ''));
        incomingFileName.current = meta.name;
        incomingFileSize.current = meta.size;
        receivedBuffers.current = [];
        receivedSize.current = 0;

        setPopupOpen(true);
        setCurrentFileName(incomingFileName.current);
        setFileProgress(0);
      } 
      else if (event.data instanceof ArrayBuffer) {
        receivedBuffers.current.push(event.data);
        receivedSize.current += event.data.byteLength;
        setFileProgress((receivedSize.current / incomingFileSize.current) * 100);

        if (receivedSize.current >= incomingFileSize.current) {
          // File complete
          const blob = new Blob(receivedBuffers.current);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = incomingFileName.current;
          a.click();

          // Add "Downloaded" message to chat
          setMessages((prev) => [...prev, `📥 Downloaded file: ${incomingFileName.current}`]);

          // Keep popup visible for a moment before closing
          setTimeout(() => {
            setPopupOpen(false);
          }, 1500);
        }
      } 
      else {
        setMessages((prev) => [...prev, event.data]);
      }
    };
  };

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    socketRef.current = io(signalingServer);
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join', { roomId });
    });

    socketRef.current.on('joined', ({ peers }) => {
      if (peers.length === 0) {
        setStatus('Waiting for peer...');
      } else {
        createPeerConnection(true, peers[0]);
      }
    });

    socketRef.current.on('peer-joined', ({ socketId }) => {
      createPeerConnection(false, socketId);
    });

    socketRef.current.on('signal', async ({ from, data }) => {
      if (data.type === 'offer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socketRef.current.emit('signal', { to: from, data: answer });
      } else if (data.type === 'answer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    return () => {
      socketRef.current?.disconnect();
      pcRef.current?.close();
    };
  }, [roomId, navigate, createPeerConnection]);

  const sendMessage = (msg) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(msg);
      setMessages((prev) => [...prev, `You: ${msg}`]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPopupOpen(true);
    setCurrentFileName(file.name);
    setFileProgress(0);

    dataChannelRef.current.send(`FILE_META:${JSON.stringify({ name: file.name, size: file.size })}`);

    const chunkSize = 16 * 1024;
    let offset = 0;

    const reader = new FileReader();
    reader.onload = () => {
      sendChunk();
    };
    reader.readAsArrayBuffer(file);

    const sendChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      const fr = new FileReader();
      fr.onload = (ev) => {
        dataChannelRef.current.send(ev.target.result);
        offset += ev.target.result.byteLength;
        setFileProgress((offset / file.size) * 100);

        if (offset < file.size) {
          sendChunk();
        } else {
          setTimeout(() => setPopupOpen(false), 1500);
        }
      };
      fr.readAsArrayBuffer(slice);
    };
  };

  return (
    <div className="min-h-screen p-6 text-white bg-gray-900">
      <h1 className="text-3xl font-bold mb-4">Room: {roomId}</h1>
      <p>Status: {status}</p>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Type a message"
          className="p-2 rounded bg-gray-800 border border-gray-700"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendMessage(e.target.value);
              e.target.value = '';
            }
          }}
        />
        <input type="file" onChange={handleFileSelect} className="p-2" />
      </div>

      <div className="mt-4">
        <h2 className="text-xl font-semibold">Messages:</h2>
        <div className="bg-gray-800 p-4 rounded mt-2 max-h-60 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx}>{msg}</div>
          ))}
        </div>
      </div>

      {popupOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg pointer-events-auto">
            <h3 className="text-lg font-bold mb-2">Transferring: {currentFileName}</h3>
            <div className="w-64 bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-500 h-4 transition-all"
                style={{ width: `${fileProgress}%` }}
              ></div>
            </div>
            <p className="mt-2">{Math.round(fileProgress)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
