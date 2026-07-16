import type { CSSProperties, ReactNode } from 'react'

export const mono = "'IBM Plex Mono', ui-monospace, monospace"
export const serif = "'Instrument Serif', Georgia, serif"
export const accent = '#3ddc84'

export const panelStyle: CSSProperties = {
  borderRadius: 24,
  background:
    'radial-gradient(120% 90% at 50% -10%, #11261c 0%, #0a1410 45%, #060b09 100%)',
  color: '#e8efe9',
  fontFamily: mono,
  padding: 'clamp(24px,4vw,44px)',
  border: '1px solid rgba(255,255,255,.06)',
}

export function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: accent,
          boxShadow: '0 0 8px rgba(61,220,132,.7)',
        }}
      />
      <span style={{ fontSize: 12, letterSpacing: 2, color: '#e8efe9' }}>
        GRID CARBON CLOCK
      </span>
    </div>
  )
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div style={panelStyle}>{children}</div>
    </div>
  )
}
