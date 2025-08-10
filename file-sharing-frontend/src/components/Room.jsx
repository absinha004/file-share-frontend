import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:5000';
const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CHUNK_SIZE = 64 * 1024; // 64KB
const BACKPRESSURE_THRESHOLD = 1 * 1024 * 1024; // 1MB

export default function Room({ roomId }) {
  const socketRef = useRef();
  const pcRef = useRef();
  const controlRef = useRef();
  const fileRef = useRef();
  const peerIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const incomingFilesRef = useRef({}); // id -> { meta, parts, received }

  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState('');
  const [filesList, setFilesList] = useState([]);

  useEffect(() => {
    const socket = io(SIGNALING_URL);
    socketRef.current = socket;

    socket.on('connect', () => log('socket connected ' + socket.id));
    socket.on('joined', ({ peers }) => {
      log('joined room, peers: ' + peers.join(', '));
      if (peers.length > 0) {
        peerIdRef.current = peers[0];
        startPeer(true);
      } else {
        log('waiting for peer to join...');
      }
    });

    socket.on('peer-joined', ({ socketId }) => {
      log('peer-joined: ' + socketId);
      // If we were waiting and we are the first (creator), the new peer will be initiator.
      // If we are second, we set peerId so ICE can be sent.
      peerIdRef.current = socketId;
    });

    socket.on('signal', async ({ from, data }) => {
      log('signal from ' + from + ' type=' + (data.type || 'candidate'));
      // ensure pc exists
      if (!pcRef.current) {
        await startPeer(false);
      }
      const pc = pcRef.current;

      if (data.type === 'offer') {
        // remote offer -> setRemote, createAnswer
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, data: pc.localDescription });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        // apply queued candidates
        for (const c of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(c); } catch(e){ console.warn('cand add err',e); }
        }
        pendingCandidatesRef.current = [];
      } else if (data.candidate) {
        const cand = new RTCIceCandidate(data);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(cand); }
          catch (e) { console.warn('addIceCandidate error', e); }
        } else {
          pendingCandidatesRef.current.push(cand);
        }
      }
    });

    socket.on('peer-left', ({ socketId }) => {
      log('peer-left: ' + socketId);
      cleanupPeer();
    });

    socket.on('room-full', () => {
      alert('Room is full (2 people max).');
    });

    // join the room
    socket.emit('join', { roomId });

    return () => {
      socket.disconnect();
      cleanupPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function log(s) { setLogs(l => [...l, s]); }

  async function startPeer(isInitiator) {
    if (pcRef.current) return;
    log('creating RTCPeerConnection; initiator=' + isInitiator);
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && peerIdRef.current) {
        socketRef.current.emit('signal', { to: peerIdRef.current, data: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      log('pc state: ' + pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeer();
      }
    };

    pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      if (ch.label === 'control') setupControlChannel(ch);
      if (ch.label === 'file') setupFileChannel(ch);
    };

    // create channels if initiator
    if (isInitiator) {
      const controlCh = pc.createDataChannel('control', { ordered: true });
      setupControlChannel(controlCh);

      const fileCh = pc.createDataChannel('file', { ordered: true });
      setupFileChannel(fileCh);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // send offer to peer
      if (peerIdRef.current) {
        socketRef.current.emit('signal', { to: peerIdRef.current, data: pc.localDescription });
      } else {
        log('no peerId to send offer to yet; will rely on peer-joined to set peerId');
      }
    }
  }

  function setupControlChannel(ch) {
    controlRef.current = ch;
    ch.onopen = () => log('control channel open');
    ch.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'chat') {
          setLogs(l => [...l, 'peer: ' + data.text]);
        } else if (data.type === 'file-meta') {
          incomingFilesRef.current[data.id] = { meta: data, parts: [], received: 0 };
          setFilesList(list => [...list, { id: data.id, name: data.name, incoming: true }]);
        } else if (data.type === 'file-complete') {
          const obj = incomingFilesRef.current[data.id];
          if (!obj) return;
          const blob = new Blob(obj.parts, { type: obj.meta.mime || '' });
          const url = URL.createObjectURL(blob);
          // create download link on the fly
          const a = document.createElement('a');
          a.href = url;
          a.download = obj.meta.name || 'file';
          a.click();
          URL.revokeObjectURL(url);
          delete incomingFilesRef.current[data.id];
          setFilesList(list => list.map(f => f.id === data.id ? {...f, incoming: false, received: true} : f));
          log('received file: ' + obj.meta.name);
        }
      } catch (e) {
        console.warn('control msg parse err', e);
      }
    };
  }

  function setupFileChannel(ch) {
    fileRef.current = ch;
    ch.onopen = () => log('file channel open');
    ch.onmessage = (ev) => {
      // binary chunk
      const arr = ev.data;
      // assume single active incoming file: match by first incomingFiles key
      const keys = Object.keys(incomingFilesRef.current);
      if (keys.length === 0) {
        console.warn('no meta for incoming chunk');
        return;
      }
      const k = keys[0];
      const obj = incomingFilesRef.current[k];
      obj.parts.push(arr);
      obj.received += arr.byteLength || arr.length;
      // progress tracking could be added here
    };
    // set buffered low threshold for backpressure events
    try {
      fileRef.current.bufferedAmountLowThreshold = 512 * 1024;
    } catch {}
  }

  function cleanupPeer() {
    try { controlRef.current?.close(); } catch {}
    try { fileRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    controlRef.current = null;
    fileRef.current = null;
    pcRef.current = null;
    peerIdRef.current = null;
    pendingCandidatesRef.current = [];
    log('cleaned up peer');
  }

  // CHAT send
  function sendChat() {
    if (!controlRef.current || controlRef.current.readyState !== 'open') {
      alert('Control channel not open yet');
      return;
    }
    controlRef.current.send(JSON.stringify({ type: 'chat', text: msg }));
    setLogs(l => [...l, 'me: ' + msg]);
    setMsg('');
  }

  // FILE send (chunked)
  async function sendFile(file) {
    if (!controlRef.current || controlRef.current.readyState !== 'open' ||
        !fileRef.current || fileRef.current.readyState !== 'open') {
      alert('Data channels not ready');
      return;
    }
    const id = Math.random().toString(36).slice(2, 9);
    controlRef.current.send(JSON.stringify({ type: 'file-meta', id, name: file.name, size: file.size, mime: file.type }));
    setFilesList(list => [...list, { id, name: file.name, outgoing: true }]);
    const dc = fileRef.current;

    let offset = 0;
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buf = await chunk.arrayBuffer();

      // backpressure
      if (dc.bufferedAmount > BACKPRESSURE_THRESHOLD) {
        await new Promise(resolve => {
          const onLow = () => {
            dc.removeEventListener('bufferedamountlow', onLow);
            resolve();
          };
          dc.addEventListener('bufferedamountlow', onLow);
          try { dc.bufferedAmountLowThreshold = 512 * 1024; } catch {}
        });
      }

      dc.send(buf);
      offset += buf.byteLength;
    }

    controlRef.current.send(JSON.stringify({ type: 'file-complete', id }));
    log('sent file ' + file.name);
  }

  return (
    <div>
      <h3>Room: {roomId}</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 400 }}>
          <div style={{ height: 220, overflow: 'auto', border: '1px solid #ddd', padding: 8 }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div style={{ marginTop: 8 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message..." />
            <button onClick={sendChat} style={{ marginLeft: 8 }}>Send</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <input type="file" onChange={(e) => { const f = e.target.files[0]; if (f) sendFile(f); }} />
          </div>
        </div>

        <div>
          <h4>Files</h4>
          <ul>
            {filesList.map(f => (
              <li key={f.id}>
                {f.name} {f.incoming ? '(receiving...)' : f.outgoing ? '(sent)' : f.received ? '(downloaded)' : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
