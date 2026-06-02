import { GRID_REGION } from './config'

const BASE_URL = 'https://api.watttime.org'
const FETCH_TIMEOUT_MS = Number(process.env.WATTTIME_FETCH_TIMEOUT) || 10000

let cachedToken: string | null = null
let tokenFetchedAt: number | null = null
const TOKEN_TTL_MS = 25 * 60 * 1000 // 25 min — tokens expire ~30 min

// ── Auth ───────────────────────────────────────────────────────────────────

export async function getToken(): Promise<string> {
  if (
    cachedToken &&
    tokenFetchedAt &&
    Date.now() - tokenFetchedAt < TOKEN_TTL_MS
  ) {
    return cachedToken
  }
  return refreshToken()
}

async function refreshToken(): Promise<string> {
  const username = process.env.WATTTIME_USERNAME
  const password = process.env.WATTTIME_PASSWORD
  if (!username || !password) {
    throw new Error(
      'WATTTIME_USERNAME and WATTTIME_PASSWORD must be set in .env.server',
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const credentials = Buffer.from(`${username}:${password}`).toString(
      'base64',
    )
    const res = await fetch(`${BASE_URL}/login`, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`WattTime login failed (${res.status}): ${body}`)
    }

    const json = (await res.json()) as { token: string }
    cachedToken = json.token
    tokenFetchedAt = Date.now()
    return cachedToken
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`WattTime login timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function authedFetch(url: string): Promise<Response> {
  let token = await getToken()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })

    if (res.status === 401) {
      cachedToken = null
      token = await refreshToken()
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
    }

    return res
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`WattTime request timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Forecast ───────────────────────────────────────────────────────────────
// GET /v3/forecast — values in lbs CO₂/MWh, 5-min resolution

export interface ForecastPoint {
  point_time: string
  value: number // lbs CO₂/MWh
}

export interface ForecastRun {
  generated_at: string
  forecast: ForecastPoint[]
}

interface ForecastApiResponse {
  data: ForecastPoint[]
  meta: {
    generated_at: string
    units: string
    region: string
    signal_type: string
  }
}

export async function fetchForecast(): Promise<ForecastRun> {
  const url = `${BASE_URL}/v3/forecast?region=${GRID_REGION}&signal_type=co2_moer`
  const res = await authedFetch(url)

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`WattTime forecast failed (${res.status}): ${body}`)
  }

  const json = (await res.json()) as ForecastApiResponse
  if (!json.data || json.data.length === 0) {
    throw new Error('WattTime forecast returned empty data array')
  }

  return {
    generated_at: json.meta.generated_at,
    forecast: json.data,
  }
}

// ── Unit conversion ────────────────────────────────────────────────────────

export function lbsMwhToGCO2KWh(lbsPerMwh: number): number {
  return (lbsPerMwh * 453.592) / 1000
}
