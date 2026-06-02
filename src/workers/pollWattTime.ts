import { type PollWattTime } from 'wasp/server/jobs'
import { prisma } from 'wasp/server'
import { fetchForecast, lbsMwhToGCO2KWh } from '../lib/watttime'
import { GRID_REGION as REGION } from '../lib/config'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const pollWattTime: PollWattTime<Record<string, never>, void> = async (
  _args,
  context,
) => {
  console.log('[pollWattTime] Starting WattTime poll...')

  const forecastRun = await fetchForecast()
  const now = new Date()

  const allPoints = forecastRun.forecast
  const pastPoints = allPoints.filter(p => new Date(p.point_time) <= now)
  const futurePoints = allPoints.filter(p => new Date(p.point_time) > now)

  // Store the most recent past forecast point as the "actual" reading
  const latestActual = pastPoints[pastPoints.length - 1]
  if (latestActual) {
    const moer = lbsMwhToGCO2KWh(latestActual.value)
    await context.entities.GridReading.create({
      data: {
        region: REGION,
        ts: new Date(latestActual.point_time),
        moer,
        kind: 'actual',
      },
    })
    console.log(
      `[pollWattTime] Actual: ${moer.toFixed(1)} gCO\u2082/kWh at ${latestActual.point_time}`,
    )
  }

  // Replace all future forecast rows for this region
  if (futurePoints.length > 0) {
    const deleted = await prisma.$transaction(async tx => {
      const { count } = await tx.gridReading.deleteMany({
        where: { region: REGION, kind: 'forecast', ts: { gt: now } },
      })
      await tx.gridReading.createMany({
        data: futurePoints.map(p => ({
          region: REGION,
          ts: new Date(p.point_time),
          moer: lbsMwhToGCO2KWh(p.value),
          kind: 'forecast',
        })),
      })
      return count
    })
    console.log(
      `[pollWattTime] Forecast: replaced ${deleted} stale rows with ${futurePoints.length} new rows`,
    )
  }

  // Prune actuals older than 7 days to keep the table lean
  const { count: pruned } = await context.entities.GridReading.deleteMany({
    where: {
      region: REGION,
      kind: 'actual',
      ts: { lt: new Date(now.getTime() - SEVEN_DAYS_MS) },
    },
  })
  if (pruned > 0) {
    console.log(`[pollWattTime] Pruned ${pruned} old actual rows`)
  }

  console.log('[pollWattTime] Done.')
}
