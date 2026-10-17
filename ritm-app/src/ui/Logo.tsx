export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="ui-logo">
      <rect width="64" height="64" rx="14" style={{ fill: 'var(--logo-bg, #0f766e)' }} />
      <g style={{ fill: 'var(--logo-fg, #fff)' }}>
        <rect x="15" y="26" width="8" height="22" rx="4" />
        <rect x="28" y="14" width="8" height="34" rx="4" />
        <rect x="41" y="32" width="8" height="16" rx="4" />
      </g>
    </svg>
  )
}
