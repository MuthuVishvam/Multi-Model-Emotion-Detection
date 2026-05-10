import { create } from 'zustand';

// Auth Store
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ user: null, token: null, isLoading: false, error: null }),
}));

// Live Class Store
export const useLiveClassStore = create((set) => ({
  sessionId: null,
  isLive: false,
  participants: [],
  localStream: null,
  peers: {},
  isMicOn: true,
  isCameraOn: true,
  isScreenSharing: false,
  screenStream: null,
  chatMessages: [],
  raisedHands: [],

  setSessionId: (id) => set({ sessionId: id }),
  setIsLive: (isLive) => set({ isLive }),
  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),
  removeParticipant: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    })),
  toggleMic: () => set((state) => ({ isMicOn: !state.isMicOn })),
  toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),
  startScreenShare: (stream) => set({ isScreenSharing: true, screenStream: stream }),
  stopScreenShare: () => set({ isScreenSharing: false, screenStream: null }),
  addMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),
  addRaisedHand: (userId) =>
    set((state) => ({
      raisedHands: [...state.raisedHands, userId],
    })),
  removeRaisedHand: (userId) =>
    set((state) => ({
      raisedHands: state.raisedHands.filter((id) => id !== userId),
    })),
  reset: () =>
    set({
      sessionId: null,
      isLive: false,
      participants: [],
      localStream: null,
      peers: {},
      isMicOn: true,
      isCameraOn: true,
      isScreenSharing: false,
      screenStream: null,
      chatMessages: [],
      raisedHands: [],
    }),
}));

// Emotion Store
export const useEmotionStore = create((set) => ({
  detectedEmotions: [],
  confidenceScores: {},
  isDetecting: false,
  engagementScore: 0,
  emotionTimeline: [],

  addEmotion: (emotion, confidence) =>
    set((state) => ({
      detectedEmotions: [...state.detectedEmotions.slice(-29), emotion],
      confidenceScores: { ...state.confidenceScores, [emotion]: confidence },
    })),
  setIsDetecting: (isDetecting) => set({ isDetecting }),
  setEngagementScore: (score) => set({ engagementScore: score }),
  addTimelineEntry: (entry) =>
    set((state) => ({
      emotionTimeline: [...state.emotionTimeline, entry],
    })),
  reset: () =>
    set({
      detectedEmotions: [],
      confidenceScores: {},
      isDetecting: false,
      engagementScore: 0,
      emotionTimeline: [],
    }),
}));

// UI Store
export const useUIStore = create((set) => ({
  sidebarOpen: false,
  theme: 'dark',
  notifications: [],
  toasts: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, { id: Date.now(), ...notification }],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { id: Date.now(), ...toast }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// Lesson Store
export const useLessonStore = create((set) => ({
  currentLesson: null,
  lessons: [],
  isLoading: false,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  notes: [],

  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),
  setLessons: (lessons) => set({ lessons }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  addNote: (note) =>
    set((state) => ({
      notes: [...state.notes, note],
    })),
  reset: () =>
    set({
      currentLesson: null,
      lessons: [],
      isLoading: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      notes: [],
    }),
}));
