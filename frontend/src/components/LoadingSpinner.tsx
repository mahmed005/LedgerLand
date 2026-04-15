/* LoadingSpinner — Animated teal spinner */

export default function LoadingSpinner({ size = 40 }: { size?: number }) {
  return (
    <div className="spinner" style={{ width: size, height: size }}>
      <svg viewBox="0 0 50 50" className="spinner__svg">
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
          className="spinner__circle"
        />
      </svg>
    </div>
  );
}
