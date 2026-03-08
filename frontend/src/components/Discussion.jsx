import FeedbackRecorder from "./FeedbackRecorder";

export default function Discussion({
  userId,
  courseId,
  classId,
  lessonId,
  sessionId,
  liveSessionId,
  setSessionId,
  sessionName,
  setSessionName,
  startSession,
  text,
  setText,
  submitDiscussionMessage,
  statusMessage,
  isSubmitting,
  discussionMessages,
  sessionEmotionCounts,
  setStatusMessage,
  onVoicePrediction,
}) {
  const emotionCountEntries = Object.entries(sessionEmotionCounts || {});

  return (
    <div className="side-panel-section">
      <h4>Discussion & Commands</h4>
      <p className="small-note">Each submitted message is classified on the backend and tagged with emotion.</p>

      <label>Session Name</label>
      <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
      <button type="button" onClick={startSession}>Start Session</button>

      <label>Session ID</label>
      <input
        value={sessionId}
        onChange={(event) => setSessionId(event.target.value)}
        placeholder="Paste or create session ID"
      />

      <label>Comment</label>
      <textarea
        className="notes-textarea notes-textarea--compact"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type a discussion comment or question..."
      />
      <button type="button" onClick={submitDiscussionMessage} disabled={isSubmitting}>
        {isSubmitting ? "Classifying..." : "Send Comment"}
      </button>

      <FeedbackRecorder
        userId={userId}
        courseId={courseId}
        classId={classId}
        lessonId={lessonId}
        sessionId={sessionId}
        liveSessionId={liveSessionId}
        onStatusMessage={setStatusMessage}
        onPrediction={onVoicePrediction}
      />

      {statusMessage && <div className="inline-message inline-message-soft">{statusMessage}</div>}

      {emotionCountEntries.length > 0 && (
        <div className="discussion-counts">
          {emotionCountEntries.map(([emotion, count]) => (
            <span key={emotion} className="emotion-count-chip">
              {emotion}: {count}
            </span>
          ))}
        </div>
      )}

      <div className="discussion-thread">
        {discussionMessages.length === 0 && (
          <p className="small-note">No comments or feedback yet for this lesson.</p>
        )}

        {discussionMessages.map((entry) => (
          <article key={entry.id} className="discussion-message">
            <div className="discussion-message__row">
              <p>{entry.text}</p>
              <span className={`emotion-tag emotion-tag--${entry.emotion}`}>
                {entry.emotion} {Number(entry.confidence || 0).toFixed(2)}
              </span>
            </div>
            <p className="small-note">
              {new Date(entry.timestamp).toLocaleTimeString()} | {entry.authorName || "Student"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
