import { useAuth } from '../context/AuthContext';
import axios from 'axios';

// Hook for making API calls with auth
export const useApi = () => {
  const { token } = useAuth();

  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return api;
};

// Hook for WebRTC peer management
export const useWebRTC = () => {
  const [peers, setPeers] = React.useState({});
  const [localStream, setLocalStream] = React.useState(null);
  const [error, setError] = React.useState(null);

  const getLocalStream = React.useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video && { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: audio && { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      const msg = `Failed to get media: ${err.message}`;
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const stopLocalStream = React.useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const stopAllPeers = React.useCallback(() => {
    Object.values(peers).forEach(peer => {
      if (peer && typeof peer.destroy === 'function') {
        peer.destroy();
      }
    });
    setPeers({});
  }, [peers]);

  React.useEffect(() => {
    return () => {
      stopLocalStream();
      stopAllPeers();
    };
  }, []);

  return {
    peers,
    setPeers,
    localStream,
    error,
    getLocalStream,
    stopLocalStream,
    stopAllPeers,
  };
};

// Hook for Socket.IO connection
export const useSocket = () => {
  const [socket, setSocket] = React.useState(null);
  const [connected, setConnected] = React.useState(false);
  const { token } = useAuth();

  React.useEffect(() => {
    if (!token) return;

    const io = require('socket.io-client').default;
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return { socket, connected };
};

// Hook for emotion detection
export const useEmotionDetection = () => {
  const [emotions, setEmotions] = React.useState([]);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [error, setError] = React.useState(null);

  return {
    emotions,
    isDetecting,
    error,
    setEmotions,
    setIsDetecting,
    setError,
  };
};

// Reusable import for all hooks
import React from 'react';

export { useAuth } from '../context/AuthContext';
