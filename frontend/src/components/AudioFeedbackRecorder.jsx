import { useEffect, useRef, useState } from "react";

import { apiMultipartRequest } from "../services/api";

const MIN_RECORD_SECONDS = 10;
const MAX_RECORD_SECONDS = 30;

function writeWavString(dataView, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    dataView.setUint8(offset + index, value.charCodeAt(index));
  }
}

function interleaveChannels(audioBuffer) {
  const channels = [];
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  if (channels.length === 1) {
    return channels[0];
  }

  const length = channels[0].length * channels.length;
  const interleaved = new Float32Array(length);
  let offset = 0;
  for (let sampleIndex = 0; sampleIndex < channels[0].length; sampleIndex += 1) {
    for (let channel = 0; channel < channels.length; channel += 1) {
      interleaved[offset] = channels[channel][sampleIndex];
      offset += 1;
    }
  }
  return interleaved;
}

function floatTo16BitPCM(dataView, offset, input) {
  for (let index = 0; index < input.length; index += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    dataView.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

function audioBufferToWav(audioBuffer) {
  const interleaved = interleaveChannels(audioBuffer);
  const bytesPerSample = 2;
  const blockAlign = audioBuffer.numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + interleaved.length * bytesPerSample);
  const view = new DataView(buffer);

  writeWavString(view, 0, "RIFF");
  view.setUint32(4, 36 + interleaved.length * bytesPerSample, true);
  writeWavString(view, 8, "WAVE");
  writeWavString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, audioBuffer.numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeWavString(view, 36, "data");
  view.setUint32(40, interleaved.length * bytesPerSample, true);
  floatTo16BitPCM(view, 44, interleaved);

  return buffer;
}

async function convertBlobToWav(blob) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Audio context is not supported in this browser.");
  }

  const context = new AudioContextCtor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer);
    const wavBuffer = audioBufferToWav(decoded);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    await context.close().catch(() => {});
  }
}

function getPreferredMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = ["audio/webm", "audio/ogg", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function extensionForMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("wav")) {
    return "wav";
  }
  if (normalized.includes("webm")) {
    return "webm";
  }
  if (normalized.includes("ogg")) {
    return "ogg";
  }
  if (normalized.includes("mpeg") || normalized.includes("mp3")) {
    return "mp3";
  }
  if (normalized.includes("mp4")) {
    return "m4a";
  }
  return "webm";
}

function isPermissionDenied(error) {
  return (
    error?.name === "NotAllowedError"
    || error?.name === "PermissionDeniedError"
    || String(error?.message || "").toLowerCase().includes("denied")
  );
}

export default function AudioFeedbackRecorder({
  userId,
  courseId,
  classId,
  lessonId,
  sessionId,
  onPrediction,
  onStatusMessage,
}) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingSecondsRef = useRef(0);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastVoiceResult, setLastVoiceResult] = useState(null);

  function clearTimers() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function resetRecordingClock() {
    recordingSecondsRef.current = 0;
    setRecordingSeconds(0);
  }

  async function uploadAudioBlob(blob, timestamp, filename) {
    const normalizedUserId = String(userId || "").trim();
    const normalizedCourseId = String(courseId || "").trim();
    const normalizedClassId = String(classId || "").trim();
    const normalizedLessonId = String(lessonId || "").trim();
    const normalizedSessionId = String(sessionId || "").trim();

    if (!normalizedUserId) {
      throw new Error("Missing user information. Please sign in again.");
    }
    if (!normalizedSessionId) {
      throw new Error("Start a session first before recording feedback.");
    }
    if (!normalizedLessonId) {
      throw new Error("Open a lesson before recording voice feedback.");
    }

    const token = localStorage.getItem("token") || "";
    const formData = new FormData();
    formData.append("userId", normalizedUserId);
    if (normalizedCourseId) {
      formData.append("courseId", normalizedCourseId);
    }
    if (normalizedClassId) {
      formData.append("classId", normalizedClassId);
    }
    formData.append("lessonId", normalizedLessonId);
    formData.append("sessionId", normalizedSessionId);
    formData.append("timestamp", timestamp);
    formData.append("audio_file", blob, filename);

    const response = await apiMultipartRequest("/emotions/voice", "POST", formData, token, {
      timeoutMs: 30000,
      retryCount: 0,
    });

    return response;
  }

  async function finalizeRecording() {
    clearTimers();
    setIsRecording(false);

    const seconds = recordingSecondsRef.current;
    if (seconds < MIN_RECORD_SECONDS) {
      setErrorText(`Please record at least ${MIN_RECORD_SECONDS} seconds.`);
      stopStream();
      return;
    }

    const recordedMimeType = recorderRef.current?.mimeType || chunksRef.current[0]?.type || "audio/webm";
    const mediaBlob = new Blob(chunksRef.current, { type: recordedMimeType });
    if (mediaBlob.size === 0) {
      setErrorText("No audio captured. Please try recording again.");
      stopStream();
      return;
    }

    setIsUploading(true);
    setErrorText("");
    const timestamp = new Date().toISOString();

    try {
      let uploadBlob = mediaBlob;
      let extension = extensionForMimeType(mediaBlob.type || recordedMimeType);
      try {
        uploadBlob = await convertBlobToWav(mediaBlob);
        extension = "wav";
      } catch {
        uploadBlob = mediaBlob;
      }
      const fileName = `voice-feedback-${Date.now()}.${extension}`;

      const prediction = await uploadAudioBlob(uploadBlob, timestamp, fileName);
      setLastVoiceResult(prediction);
      onStatusMessage?.(`Voice feedback tagged as ${prediction.emotion} (${Number(prediction.confidence || 0).toFixed(2)}).`);
      onPrediction?.({
        emotion: prediction.emotion,
        confidence: Number(prediction.confidence || 0),
        timestamp,
        feedbackId: prediction.feedback_id,
        lessonId: prediction.lesson_id,
        classId: prediction.class_id,
        fileRef: prediction.file_ref,
      });
    } catch (error) {
      setErrorText(error.message || "Voice upload failed.");
    } finally {
      setIsUploading(false);
      stopStream();
      resetRecordingClock();
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return;
    }
    recorderRef.current.stop();
  }

  async function startRecording() {
    if (!sessionId) {
      setErrorText("Start a session first before recording feedback.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorText("Audio recording is not supported in this browser.");
      return;
    }

    setErrorText("");
    setLastVoiceResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        void finalizeRecording();
      };

      recorder.onerror = () => {
        setErrorText("Recording failed. Please try again.");
        stopStream();
        setIsRecording(false);
      };

      resetRecordingClock();
      recorder.start(500);
      setIsRecording(true);

      intervalRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => {
          const next = Math.min(current + 1, MAX_RECORD_SECONDS);
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);

      timeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_SECONDS * 1000);
    } catch (error) {
      if (isPermissionDenied(error)) {
        setErrorText("Microphone permission denied. You can continue without voice tracking.");
      } else {
        setErrorText(error.message || "Unable to access microphone.");
      }
      stopStream();
      setIsRecording(false);
    }
  }

  useEffect(() => {
    return () => {
      clearTimers();
      stopStream();
    };
  }, []);

  return (
    <div className="audio-recorder">
      <p className="small-note">Record 10-30 seconds of spoken feedback.</p>

      <div className="audio-recorder__actions">
        {!isRecording && (
          <button type="button" onClick={startRecording} disabled={isUploading || !sessionId}>
            Record Feedback
          </button>
        )}

        {isRecording && (
          <button
            type="button"
            className="secondary"
            onClick={stopRecording}
            disabled={recordingSeconds < MIN_RECORD_SECONDS}
          >
            Stop ({recordingSeconds}s)
          </button>
        )}
      </div>

      {isRecording && (
        <p className="small-note">
          Recording in progress: {recordingSeconds}s / {MAX_RECORD_SECONDS}s
        </p>
      )}

      {isUploading && <p className="small-note">Uploading and classifying voice emotion...</p>}

      {lastVoiceResult && (
        <p className="small-note">
          Voice emotion: <span className={`emotion-tag emotion-tag--${lastVoiceResult.emotion}`}>
            {lastVoiceResult.emotion} {Number(lastVoiceResult.confidence || 0).toFixed(2)}
          </span>
        </p>
      )}

      {errorText && <div className="inline-message inline-message-soft">{errorText}</div>}
    </div>
  );
}

