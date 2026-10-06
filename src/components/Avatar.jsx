export default function Avatar({ url, email, size = 32, className = '' }) {
  const initials = (email || '?').slice(0, 2).toUpperCase()
  const px = `${size}px`

  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: px, height: px }}
        className={`rounded-full object-cover border border-[var(--k-line)] shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: px, height: px, fontSize: `${Math.max(10, size * 0.38)}px` }}
      className={`rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold shrink-0 ${className}`}
    >
      {initials}
    </div>
  )
}
