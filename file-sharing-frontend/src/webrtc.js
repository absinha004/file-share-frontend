import { io } from "socket.io-client";

export function initConnection({ roomId, onMessage, onFile, onPeerDisconnected }) {
  // Change this to your backend URL in prod
  const SIGNALING_URL = process.env.REACT_APP_SIGNALING_URL;

  const socket = io(SIGNALING_URL);

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }, // free STUN server
      { urls: "turn:turn.anyfirewall.com:443?transport=tcp" } //TURN testing server
    ]
  });

  let dataChannel;

  socket.on("connect", () => {
    console.log("Connected to signaling server");
    socket.emit("join", { roomId });
  });

  socket.on("joined", async ({ peers }) => {
    console.log("Joined room", roomId, "peers:", peers);
    if (peers.length > 0) {
      createDataChannel();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { to: peers[0], data: offer });
    }
  });

  socket.on("peer-joined", async ({ socketId }) => {
    console.log("Peer joined:", socketId);
  });

  socket.on("signal", async ({ from, data }) => {
    if (data.type === "offer") {
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
      };
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", { to: from, data: answer });
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    }
  });

  let peerId = null;

socket.on("joined", async ({ peers }) => {
  if (peers.length > 0) {
    peerId = peers[0]; // store peer ID
    createDataChannel();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { to: peerId, data: offer });
  }
});

socket.on("peer-joined", ({ socketId }) => {
  peerId = socketId;
});

pc.onicecandidate = (event) => {
  if (event.candidate && peerId) {
    socket.emit("signal", { to: peerId, data: event.candidate });
  }
};

  function createDataChannel() {
    dataChannel = pc.createDataChannel("chat");
    setupDataChannel();
  }

  function setupDataChannel() {
    dataChannel.onopen = () => console.log("Data channel open");
    dataChannel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "text") {
          onMessage(parsed.text);
        } else if (parsed.type === "file") {
          onFile(parsed);
        }
      } catch {
        console.log("Received raw message", event.data);
      }
    };
  }

  function sendText(text) {
    dataChannel.send(JSON.stringify({ type: "text", text }));
  }

  function sendFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      dataChannel.send(JSON.stringify({
        type: "file",
        name: file.name,
        data: reader.result
      }));
    };
    reader.readAsDataURL(file);
  }

  return { sendText, sendFile, socket };
}
