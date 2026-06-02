import { HttpError } from 'wasp/server'
import type { GetGridData, SetNotifyThreshold, TriggerPoll } from 'wasp/server/operations'
import type { GridReading } from 'wasp/entities'
import { pollWattTime } from '../workers/pollWattTime'

const REGION = 'CAISO_NORTH'
const WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours

// ── Public types ───────────────────────────────────────────────────────────

export type HourlyPoint = {
  ts: number   // Unix ms
  moer: number // gCO₂/kWh
}

export type CleanestWindow = {
  startTs: number
  endTs: number
  avgMoer: number
  savingsPct: number // % cleaner vs current reading
}

export type GridDataResponse = {
  currentMoer: number | null
  cleanScore: number | null // 0–100, higher = cleaner
  forecast: HourlyPoint[]
  cleanestWindow: CleanestWindow | null
  fetchedAt: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Map CAISO MOER (typically 90–450 gCO₂/kWh) to a 0–100 clean score
// 90 gCO₂/kWh → ~100,  450 gCO₂/kWh → 0
function computeCleanScore(moer: number): number {
  return Math.round(Math.max(0, Math.min(100, (450 - moer) / 3.6)))
}

function downsampleHourly(readings: GridReading[]): HourlyPoint[] {
  const byHour = new Map<number, GridReading>()
  for (const r of readings) {
    const hourKey = Math.floor(r.ts.getTime() / (60 * 60 * 1000))
    if (!byHour.has(hourKey)) byHour.set(hourKey, r)
  }
  return Array.from(byHour.values())
    .sort((a, b) => a.ts.getTime() - b.ts.getTime())
    .map(r => ({ ts: r.ts.getTime(), moer: r.moer }))
}

function findCleanestWindow(
  readings: GridReading[],
  currentMoer: number | null,
): CleanestWindow | null {
  const now = Date.now()
  const future = readings
    .filter(r => r.ts.getTime() > now)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime())

  if (future.length < 2) return null

  let bestAvg = Infinity
  let bestIdx = 0

  for (let i = 0; i < future.length; i++) {
    const windowEnd = future[i].ts.getTime() + WINDOW_MS
    const pts = future.filter(
      r => r.ts.getTime() >= future[i].ts.getTime() && r.ts.getTime() <= windowEnd,
    )
    if (pts.length < 2) continue
    const avg = pts.reduce((s, r) => s + r.moer, 0) / pts.length
    if (avg < bestAvg) {
      bestAvg = avg
      bestIdx = i
    }
  }

  if (bestAvg === Infinity) return null

  const savingsPct =
    currentMoer !== null && currentMoer > bestAvg
      ? Math.round((1 - bestAvg / currentMoer) * 100)
      : 0

  return {
    startTs: future[bestIdx].ts.getTime(),
    endTs: future[bestIdx].ts.getTime() + WINDOW_MS,
    avgMoer: Math.round(bestAvg),
    savingsPct,
  }
}

// ── Query ──────────────────────────────────────────────────────────────────

export const getGridData = (async (_args, context) => {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [latestActual, forecastReadings] = await Promise.all([
    context.entities.GridReading.findFirst({
      where: { region: REGION, kind: 'actual' },
      orderBy: { ts: 'desc' },
    }),
    context.entities.GridReading.findMany({
      where: { region: REGION, kind: 'forecast', ts: { gte: now, lte: in24h } },
      orderBy: { ts: 'asc' },
    }),
  ])

  const currentMoer = latestActual?.moer ?? null
  const cleanScore = currentMoer !== null ? computeCleanScore(currentMoer) : null
  const forecast = downsampleHourly(forecastReadings)
  const cleanestWindow = findCleanestWindow(forecastReadings, currentMoer)

  return {
    currentMoer,
    cleanScore,
    forecast,
    cleanestWindow,
    fetchedAt: latestActual?.fetchedAt.toISOString() ?? null,
  }
}) satisfies GetGridData

export type GetGridDataResponse = Awaited<ReturnType<typeof getGridData>>

// ── Action ─────────────────────────────────────────────────────────────────

export const setNotifyThreshold = (async (
  args: { threshold: number },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401, 'Must be logged in to save preferences')
  }

  const threshold = Math.round(args.threshold)
  if (threshold < 0 || threshold > 1000) {
    throw new HttpError(400, 'Threshold must be between 0 and 1000 gCO\u2082/kWh')
  }

  await context.entities.User.update({
    where: { id: context.user.id },
    data: { notifyBelow: threshold },
  })

  return { ok: true, threshold }
}) satisfies SetNotifyThreshold

// ── Manual Trigger ────────────────────────────────────────────────────────────

export const triggerPoll = (async (_args, context) => {
  const isDev = process.env.NODE_ENV !== 'production'
  if (!isDev && !context.user?.isAdmin) {
    throw new HttpError(403, 'Manual poll is restricted to admins')
  }
  console.log('[triggerPoll] Manual poll triggered')
  await pollWattTime(_args, context)
  return { ok: true, message: 'Poll completed' }
}) satisfies TriggerPoll
