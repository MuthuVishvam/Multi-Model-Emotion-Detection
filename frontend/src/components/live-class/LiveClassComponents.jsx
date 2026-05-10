import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  X,
  Users,
  MessageSquare,
  Hand,
  MoreVertical,
  Maximize2,
  Grid3x3,
} from 'lucide-react';
import { Button, Card } from './common/BaseComponents';
import toast from 'react-hot-toast';

// Video Grid Component - shows multiple participants
export const VideoGrid = ({ participants, localStream, isTeacher }) => {
  const [gridLayout, setGridLayout] = useState('gallery');
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Layout Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Class Room</h3>
        <button
          onClick={() => setGridLayout(gridLayout === 'gallery' ? 'speaker' : 'gallery')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Grid3x3 size={20} className="text-white" />
        </button>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 bg-black rounded-2xl overflow-hidden relative group">
        {gridLayout === 'speaker' ? (
          // Speaker View
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
            {participants.length > 0 && participants[0].stream ? (
              <video
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                ref={el => {
                  if (el && participants[0].stream) {
                    el.srcObject = participants[0].stream;
                  }
                }}
              />
            ) : (
              <div className="text-white/50 text-center">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>Waiting for participants...</p>
              </div>
            )}
          </div>
        ) : (
          // Gallery View
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 h-full auto-rows-max content-start">
            {/* Local Video */}
            <div className="relative bg-gradient-to-br from-slate-800 to-black rounded-lg overflow-hidden aspect-video">
              <video
                autoPlay
                muted
                playsInline
                ref={localVideoRef}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                You
              </div>
            </div>

            {/* Remote Videos */}
            {participants.map(participant => (
              <ParticipantVideo key={participant.id} participant={participant} />
            ))}
          </div>
        )}

        {/* Floating Emotion Indicator */}
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">Recording</span>
          </div>
        </div>
      </div>

      {/* Participants Bar (Bottom) */}
      <div className="bg-black/50 rounded-xl p-4 overflow-x-auto">
        <div className="flex gap-3">
          {participants.map(p => (
            <div key={p.id} className="flex-shrink-0">
              <img
                src={p.avatar}
                alt={p.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Individual Participant Video Component
const ParticipantVideo = ({ participant }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative bg-gradient-to-br from-slate-800 to-black rounded-lg overflow-hidden aspect-video group">
      <video
        autoPlay
        playsInline
        ref={videoRef}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
        <div />
        <div className="flex justify-between items-end">
          <div>
            <h4 className="text-white font-semibold text-sm">{participant.name}</h4>
            {participant.emotion && (
              <p className="text-white/60 text-xs">😊 {participant.emotion}</p>
            )}
          </div>
          <button className="p-1 hover:bg-white/20 rounded">
            <MoreVertical size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Control Bar Component
export const ControlBar = ({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  onMicToggle,
  onCameraToggle,
  onScreenShare,
  onEndCall,
  onChat,
  onRaiseHand,
  isTeacher,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-30"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
    >
      <div className="glass border-t border-white/10 px-8 py-4 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex justify-center items-center gap-4 flex-wrap">
          {/* Mic Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onMicToggle}
            className={`p-3 rounded-full transition-all ${
              isMicOn
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
            }`}
            title={isMicOn ? 'Mute' : 'Unmute'}
          >
            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </motion.button>

          {/* Camera Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCameraToggle}
            className={`p-3 rounded-full transition-all ${
              isCameraOn
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
            }`}
            title={isCameraOn ? 'Stop video' : 'Start video'}
          >
            {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
          </motion.button>

          {/* Screen Share (Teacher Only) */}
          {isTeacher && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onScreenShare}
              className={`p-3 rounded-full transition-all ${
                isScreenSharing
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Share screen"
            >
              <Share2 size={24} />
            </motion.button>
          )}

          {/* Chat */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onChat}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Chat"
          >
            <MessageSquare size={24} />
          </motion.button>

          {/* Raise Hand (Student Only) */}
          {!isTeacher && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRaiseHand}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Raise hand"
            >
              <Hand size={24} />
            </motion.button>
          )}

          {/* Separator */}
          <div className="w-px h-8 bg-white/20 mx-4" />

          {/* More Options */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMenu(!showMenu)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <MoreVertical size={24} />
            </motion.button>
            {showMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-slate-900 border border-white/10 rounded-lg py-2 w-48 shadow-xl">
                <button className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors">
                  Settings
                </button>
                <button className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors">
                  Participants
                </button>
                <button className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors">
                  Recording
                </button>
              </div>
            )}
          </div>

          {/* End Call */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEndCall}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all"
            title="End call"
          >
            <X size={24} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// Chat Panel Component
export const ChatPanel = ({ messages, onSendMessage, isOpen, onClose }) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed right-0 top-16 bottom-20 w-80 glass border-l border-white/10 flex flex-col z-20"
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-white font-semibold">Chat</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <img
                  src={msg.avatar}
                  alt={msg.sender}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{msg.sender}</p>
                  <p className="text-white/70 text-sm bg-white/5 rounded px-3 py-2 mt-1">
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-primary-500"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={!messageText.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Emotion Indicator Component
export const EmotionIndicator = ({ emotion, confidence, isDetecting }) => {
  const emotionEmojis = {
    happy: '😊',
    sad: '😞',
    confused: '😕',
    focused: '😐',
    bored: '😑',
    surprised: '😮',
    neutral: '😐',
  };

  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="relative">
        {isDetecting && (
          <div className="absolute inset-0 border-2 border-primary-500 rounded-full animate-pulse" />
        )}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-3xl">
          {emotionEmojis[emotion] || '😐'}
        </div>
      </div>
      <div className="flex-1">
        <p className="text-white/60 text-sm">Detected Emotion</p>
        <h4 className="text-white font-bold capitalize">{emotion}</h4>
        <div className="mt-2 bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 to-secondary-500 h-full"
            style={{ width: `${(confidence || 0) * 100}%` }}
          />
        </div>
        <p className="text-white/60 text-xs mt-1">{Math.round((confidence || 0) * 100)}% confidence</p>
      </div>
    </Card>
  );
};
