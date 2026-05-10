function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12.24 10.285v3.821h5.445c-.24 1.543-1.8 4.525-5.445 4.525-3.278 0-5.949-2.715-5.949-6.06s2.671-6.06 5.949-6.06c1.867 0 3.116.794 3.833 1.477l2.621-2.526C17.01 3.882 14.89 3 12.24 3 7.55 3 3.75 6.805 3.75 11.57s3.8 8.57 8.49 8.57c4.897 0 8.145-3.44 8.145-8.28 0-.557-.06-.98-.135-1.575H12.24Z"
      />
      <path
        fill="#34A853"
        d="M3.75 7.885 6.9 10.18c.855-2.64 3.29-4.47 5.34-4.47 1.867 0 3.116.795 3.833 1.478l2.621-2.527C17.01 3.882 14.89 3 12.24 3c-3.23 0-6.165 1.86-7.65 4.885Z"
      />
      <path
        fill="#4A90E2"
        d="M12.24 20.14c2.58 0 4.74-.855 6.315-2.325l-3.09-2.535c-.825.585-1.935.99-3.225.99-3.63 0-5.28-2.88-5.49-4.32L3.57 14.37c1.47 3.06 4.56 5.77 8.67 5.77Z"
      />
      <path
        fill="#FBBC05"
        d="M6.75 11.95c-.09-.315-.15-.645-.15-.985 0-.34.06-.67.15-.985L3.57 7.63A8.626 8.626 0 0 0 3 11.57c0 1.395.33 2.715.915 3.94l3.18-2.44c-.18-.52-.345-.89-.345-1.12Z"
      />
    </svg>
  );
}

export default function OAuthButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="safe-button-secondary flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm"
    >
      <GoogleMark />
      <span>Sign in with Google</span>
    </button>
  );
}
