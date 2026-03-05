export default function VideoPlayer({ src = "", ...props }) {
  if (!src) {
    return <div className="privacy-placeholder">No video source available.</div>;
  }
  return (
    <video className="lesson-video" controls src={src} {...props}>
      Your browser does not support video playback.
    </video>
  );
}
