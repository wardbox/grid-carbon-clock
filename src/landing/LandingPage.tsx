import { useState, useEffect, useMemo } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useAuth } from 'wasp/client/auth'
import {
  useQuery,
  getGridData,
  setNotifyThreshold,
  triggerPoll,
} from 'wasp/client/operations'
import { format } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { GetGridDataResponse, HourlyPoint } from '../grid/operations'

// ── Intensity meta ─────────────────────────────────────────────────────────

interface IntensityMeta {
  label: string
  color: string
  glow: string
}

function intensityMeta(moer: number | null): IntensityMeta {
  if (moer === null)
    return { label: 'NO DATA', color: '#7d9788', glow: 'rgba(125,151,136,.3)' }
  if (moer < 180)
    return { label: 'VERY CLEAN', color: '#3ddc84', glow: 'rgba(61,220,132,.45)' }
  if (moer < 280)
    return { label: 'CLEAN', color: '#9fe870', glow: 'rgba(159,232,112,.4)' }
  if (moer < 400)
    return { label: 'MODERATE', color: '#f5c451', glow: 'rgba(245,196,81,.4)' }
  return { label: 'DIRTY', color: '#ff6b5e', glow: 'rgba(255,107,94,.45)' }
}

function fmtHour(ts: number) {
  return format(new Date(ts), 'h a')
}

// ── Dial (full-circle clean score) ─────────────────────────────────────────

function Dial({
  pct,
  meta,
  animate,
}: {
  pct: number
  meta: IntensityMeta
  animate: boolean
}) {
  const r = 64
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c - (c * clamped) / 100
  return (
    <div style={{ position: 'relative', width: 156, height: 156 }}>
      <svg width='156' height='156' style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx='78'
          cy='78'
          r={r}
          fill='none'
          stroke='rgba(255,255,255,.08)'
          strokeWidth='12'
        />
        <circle
          cx='78'
          cy='78'
          r={r}
          fill='none'
          stroke={meta.color}
          strokeWidth='12'
          strokeLinecap='round'
          strokeDasharray={c}
          strokeDashoffset={animate ? offset : c}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)',
            filter: `drop-shadow(0 0 8px ${meta.glow})`,
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 40,
            color: meta.color,
            lineHeight: 1,
          }}
        >
          {clamped}
        </span>
        <span style={{ fontSize: 10, color: '#7d9788', letterSpacing: 1 }}>
          CLEAN SCORE
        </span>
      </div>
    </div>
  )
}

// ── Shell (gradient panel + header) ────────────────────────────────────────

function Shell({
  children,
  rightSlot,
}: {
  children: ReactNode
  rightSlot?: ReactNode
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        background:
          'radial-gradient(120% 90% at 50% -10%, #11261c 0%, #0a1410 45%, #060b09 100%)',
        color: '#e8efe9',
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        padding: 'clamp(20px,4vw,56px)',
        border: '1px solid rgba(255,255,255,.06)',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: 2, color: '#5f7a6c' }}>
            GRID CARBON CLOCK
          </div>
          <div
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'baseline',
              fontSize: 12,
              color: '#5f7a6c',
            }}
          >
            {rightSlot}
            <span>CAISO · N. CALIFORNIA</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Chart tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const moer: number = payload[0].value
  const meta = intensityMeta(moer)
  return (
    <div
      style={{
        background: '#0c1a13',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 10,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        padding: '8px 12px',
      }}
    >
      <div style={{ color: '#7d9788' }}>
        {format(new Date(label), 'EEE h:mm a')}
      </div>
      <div style={{ color: meta.color, fontWeight: 600 }}>
        {Math.round(moer)} gCO₂/kWh
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Landing() {
  const { data: user } = useAuth()
  const { data, isLoading, error } = useQuery(getGridData, undefined, {
    refetchInterval: 5 * 60 * 1000,
  })

  const [animate, setAnimate] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isPolling, setIsPolling] = useState(false)
  const isDev = import.meta.env.DEV

  const grid = data as GetGridDataResponse | undefined
  const currentMoer = grid?.currentMoer ?? null
  const forecast = useMemo<HourlyPoint[]>(() => grid?.forecast ?? [], [grid])
  const cleanestWindow = grid?.cleanestWindow ?? null
  const fetchedAt = grid?.fetchedAt ?? null

  // Relative clean score: rank current reading within the day's range.
  // Bimodal CAISO data makes an absolute score sit at 0/100; this gives spread.
  const pct = useMemo(() => {
    if (currentMoer === null) return 0
    const moers = forecast.map(f => f.moer).concat(currentMoer)
    const min = Math.min(...moers)
    const max = Math.max(...moers)
    if (max === min) return 50
    return Math.round(((max - currentMoer) / (max - min)) * 100)
  }, [forecast, currentMoer])

  const chartData = useMemo(() => {
    if (currentMoer === null) return forecast
    return [{ ts: Date.now(), moer: currentMoer }, ...forecast]
  }, [forecast, currentMoer])

  useEffect(() => {
    setAnimate(false)
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [data])

  async function handleManualPoll() {
    setIsPolling(true)
    try {
      await triggerPoll()
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      console.error('Poll failed:', err)
      setIsPolling(false)
    }
  }

  async function handleSaveThreshold(e: FormEvent) {
    e.preventDefault()
    const val = parseInt(thresholdInput, 10)
    if (isNaN(val) || val < 0 || val > 1000) {
      setSaveMsg('Enter a number between 0 and 1000')
      return
    }
    setSaving(true)
    setSaveMsg('')
    try {
      await setNotifyThreshold({ threshold: val })
      setSaveMsg(`Saved — you'll be notified below ${val} gCO₂/kWh`)
    } catch {
      setSaveMsg('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const pollButton = isDev ? (
    <button
      onClick={handleManualPoll}
      disabled={isPolling}
      style={{
        background: 'transparent',
        border: '1px solid rgba(255,255,255,.14)',
        borderRadius: 999,
        color: '#7d9788',
        cursor: isPolling ? 'default' : 'pointer',
        fontFamily: 'inherit',
        fontSize: 11,
        letterSpacing: 1,
        padding: '3px 10px',
      }}
    >
      {isPolling ? '⏳ POLLING' : '🔄 POLL'}
    </button>
  ) : null

  // ── Loading / error / empty states (inside the shell) ────────────────────

  if (isLoading) {
    return (
      <Shell>
        <div style={{ padding: '64px 0', textAlign: 'center', color: '#7d9788' }}>
          Loading grid data…
        </div>
      </Shell>
    )
  }

  if (error) {
    return (
      <Shell rightSlot={pollButton}>
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div style={{ color: '#ff6b5e', fontWeight: 600 }}>
            Failed to load grid data
          </div>
          <div style={{ color: '#7d9788', fontSize: 13, marginTop: 6 }}>
            {String(error)}
          </div>
        </div>
      </Shell>
    )
  }

  if (currentMoer === null && forecast.length === 0) {
    return (
      <Shell rightSlot={pollButton}>
        <div
          style={{
            padding: '64px 0',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 28 }}>⚡</div>
          <div style={{ fontWeight: 600 }}>Waiting for first data fetch</div>
          <div style={{ color: '#7d9788', fontSize: 13, maxWidth: 360 }}>
            The background job polls WattTime every 15 minutes.
            {isDev && ' Use the POLL button above to fetch now.'}
          </div>
        </div>
      </Shell>
    )
  }

  const meta = intensityMeta(currentMoer)

  return (
    <Shell rightSlot={pollButton}>
      {/* Heading */}
      <h1
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontWeight: 400,
          fontSize: 'clamp(30px,6vw,52px)',
          lineHeight: 1.05,
          margin: '0 0 36px',
          color: '#f3f8f4',
        }}
      >
        How clean is your power
        <br />
        <span style={{ fontStyle: 'italic', color: meta.color }}>
          right now?
        </span>
      </h1>

      {/* Hero gauge */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 'clamp(20px,5vw,48px)',
          alignItems: 'center',
          padding: 'clamp(24px,4vw,40px)',
          borderRadius: 20,
          background: 'rgba(255,255,255,.025)',
          border: '1px solid rgba(255,255,255,.07)',
          marginBottom: 28,
        }}
      >
        <Dial pct={pct} meta={meta} animate={animate} />
        <div>
          <div style={{ fontSize: 13, color: '#7d9788', marginBottom: 6 }}>
            CURRENT INTENSITY
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 'clamp(44px,9vw,72px)',
                lineHeight: 1,
                color: meta.color,
              }}
            >
              {currentMoer !== null ? Math.round(currentMoer) : '—'}
            </span>
            <span style={{ fontSize: 14, color: '#7d9788' }}>gCO₂/kWh</span>
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 12,
              letterSpacing: 1.5,
              color: meta.color,
              background: meta.glow,
            }}
          >
            ● {meta.label}
          </div>
          <div style={{ fontSize: 11, color: '#5f7a6c', marginTop: 10 }}>
            {fetchedAt
              ? `Updated ${format(new Date(fetchedAt), 'h:mm a')}`
              : 'No reading yet'}
          </div>
        </div>
      </div>

      {/* Cleanest window callout */}
      {cleanestWindow && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            padding: '18px 22px',
            borderRadius: 16,
            background:
              'linear-gradient(100deg, rgba(61,220,132,.12), rgba(61,220,132,.02))',
            border: '1px solid rgba(61,220,132,.25)',
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 28 }}>🌱</div>
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 1.5,
                color: '#3ddc84',
                marginBottom: 3,
              }}
            >
              CLEANEST WINDOW NEXT 24H
            </div>
            <div
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 24,
                color: '#eafff2',
              }}
            >
              {format(new Date(cleanestWindow.startTs), 'h:mm a')} –{' '}
              {format(new Date(cleanestWindow.endTs), 'h:mm a')}
              <span
                style={{
                  fontSize: 14,
                  color: '#7d9788',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {'  '}·{'  '}~{cleanestWindow.avgMoer} gCO₂/kWh
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#7d9788', marginTop: 4 }}>
              {cleanestWindow.savingsPct > 0
                ? `Run laundry, charging & dishwasher here to cut ~${cleanestWindow.savingsPct}% of emissions.`
                : 'Shift laundry, EV charging & dishwasher into this window.'}
            </div>
          </div>
        </div>
      )}

      {/* Forecast chart */}
      {forecast.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.5,
              color: '#5f7a6c',
              marginBottom: 10,
            }}
          >
            24-HOUR FORECAST
          </div>
          <div style={{ height: 220, marginLeft: -8 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id='moerFill' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor={meta.color} stopOpacity={0.5} />
                    <stop offset='100%' stopColor={meta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey='ts'
                  type='number'
                  scale='time'
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ts: number) => fmtHour(ts)}
                  tick={{ fill: '#5f7a6c', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,.08)' }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                {cleanestWindow && (
                  <ReferenceArea
                    x1={cleanestWindow.startTs}
                    x2={cleanestWindow.endTs}
                    fill='#3ddc84'
                    fillOpacity={0.14}
                  />
                )}
                <ReferenceLine
                  x={Date.now()}
                  stroke='rgba(255,255,255,.25)'
                  strokeDasharray='4 3'
                />
                <Area
                  type='monotone'
                  dataKey='moer'
                  stroke={meta.color}
                  strokeWidth={2}
                  fill='url(#moerFill)'
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: '#4d6357',
              marginTop: 4,
            }}
          >
            <span>◀ now</span>
            <span style={{ color: '#3ddc84' }}>green band = cleanest window</span>
            <span>forecast ▶</span>
          </div>
        </>
      )}

      {/* Notify threshold */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,.07)',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: '#5f7a6c' }}>
          NOTIFY ME WHEN IT&apos;S CLEAN
        </div>
        {user ? (
          <form
            onSubmit={handleSaveThreshold}
            style={{ display: 'flex', gap: 8, marginTop: 12, maxWidth: 360 }}
          >
            <input
              type='number'
              min={0}
              max={1000}
              placeholder='e.g. 200 gCO₂/kWh'
              value={thresholdInput}
              onChange={e => {
                setThresholdInput(e.target.value)
                setSaveMsg('')
              }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 10,
                color: '#e8efe9',
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 12px',
              }}
            />
            <button
              type='submit'
              disabled={saving}
              style={{
                background: '#3ddc84',
                border: 'none',
                borderRadius: 10,
                color: '#06160d',
                cursor: saving ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 16px',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        ) : (
          <div style={{ fontSize: 13, color: '#7d9788', marginTop: 12 }}>
            <a
              href='/login'
              style={{ color: '#e8efe9', textDecoration: 'underline' }}
            >
              Sign in
            </a>{' '}
            to save a notification threshold.
          </div>
        )}
        {saveMsg && (
          <div style={{ fontSize: 12, color: '#7d9788', marginTop: 8 }}>
            {saveMsg}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 11,
          color: '#3f5249',
          marginTop: 28,
          lineHeight: 1.6,
        }}
      >
        Region: CAISO_NORTH · Live data via WattTime · Marginal emissions (MOER).
      </div>
    </Shell>
  )
}
