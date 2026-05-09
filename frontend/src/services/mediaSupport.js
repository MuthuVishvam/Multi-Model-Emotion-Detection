function normalizePermissionState(state) {
  if (state === "granted" || state === "denied" || state === "prompt") {
    return state;
  }
  return "unknown";
}

export function getMediaSupportSnapshot() {
  if (typeof window === "undefined") {
    return {
      origin: "",
      secureContext: false,
      hasGetUserMedia: false,
      hasMediaRecorder: false,
    };
  }

  return {
    origin: String(window.location?.origin || ""),
    secureContext: Boolean(window.isSecureContext),
    hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    hasMediaRecorder: typeof MediaRecorder !== "undefined",
  };
}

export async function queryMediaPermissionState(name) {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({ name });
    return normalizePermissionState(result?.state);
  } catch {
    return "unknown";
  }
}

export function getCameraSupportIssue(snapshot = getMediaSupportSnapshot()) {
  if (!snapshot.secureContext) {
    return `Live camera access requires HTTPS or localhost. Current origin: ${snapshot.origin || "unknown"}.`;
  }
  if (!snapshot.hasGetUserMedia) {
    return "This browser does not expose camera capture APIs.";
  }
  return "";
}

export function getMicrophoneSupportIssue(
  snapshot = getMediaSupportSnapshot(),
  { requireRecorder = true } = {}
) {
  if (!snapshot.secureContext) {
    return `Live microphone recording requires HTTPS or localhost. Current origin: ${snapshot.origin || "unknown"}.`;
  }
  if (!snapshot.hasGetUserMedia) {
    return "This browser does not expose microphone capture APIs.";
  }
  if (requireRecorder && !snapshot.hasMediaRecorder) {
    return "This browser cannot record audio directly here. Use Upload / Record Audio instead.";
  }
  return "";
}
