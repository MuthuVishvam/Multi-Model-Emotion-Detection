function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

export default function TeacherFeedbackLists({ comments = [], voiceFeedback = [], loading = false }) {
  return (
    <section className="analytics-detail-grid">
      <div className="chart-card">
        <h3>Lesson Comments</h3>
        {loading ? (
          <p className="small-note">Loading comments...</p>
        ) : (
          <div className="analytics-list-scroll">
            {comments.map((item) => (
              <article key={item.id} className="analytics-list-item">
                <p>{item.text}</p>
                <p className="small-note">
                  {item.user_name || item.user_id} | {item.predicted_emotion} ({Number(item.confidence || 0).toFixed(2)})
                </p>
                <p className="small-note">{formatDateTime(item.created_at)}</p>
              </article>
            ))}
            {comments.length === 0 && <p className="small-note">No comments for this lesson.</p>}
          </div>
        )}
      </div>

      <div className="chart-card">
        <h3>Voice Feedback</h3>
        {loading ? (
          <p className="small-note">Loading voice feedback...</p>
        ) : (
          <div className="analytics-list-scroll">
            {voiceFeedback.map((item) => (
              <article key={item.id} className="analytics-list-item">
                <p>{item.file_ref}</p>
                <p className="small-note">
                  {item.user_name || item.user_id} | {item.predicted_emotion} ({Number(item.confidence || 0).toFixed(2)})
                </p>
                <p className="small-note">{formatDateTime(item.created_at)}</p>
              </article>
            ))}
            {voiceFeedback.length === 0 && <p className="small-note">No voice feedback for this lesson.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
