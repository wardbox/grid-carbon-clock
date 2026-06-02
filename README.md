# Grid Carbon Clock

**Live:** [your-url-here] · **Region:** CAISO Northern California

Shows how carbon-intense your grid electricity is _right now_, and the cleanest
window in the next 24 hours to run high-draw appliances — laundry, EV charging,
dishwasher. Shift your usage into the green band and cut the emissions of that
energy without changing how much you use.

## Why marginal emissions (MOER)?

This app uses **marginal** operating emissions rate, not average grid intensity.
MOER reflects which generator actually responds when you add or drop load at a
given moment — so it's the correct signal for _load-shifting_ decisions. Average
intensity tells you the grid's overall mix; marginal tells you the real
consequence of _your_ choice to run the dryer now vs. at noon. Data comes from
[WattTime](https://watttime.org).

## Why one region?

The demo runs on **CAISO_NORTH** because WattTime's free tier provides real
marginal-emissions data _and_ forecasts for that balancing authority at no cost.
The architecture is region-agnostic — the region is a single config value and
the data model is keyed by region. Adding more grids is a paid-tier API change,
not a rewrite.

## Stack

- **Wasp** — full-stack framework (auth, client/server RPC, scheduled jobs)
- **Postgres** on **Fly.io**, **Prisma** ORM
- **Wasp Jobs (PgBoss)** — polls WattTime every 15 min, stores actuals +
  forecast
- **React + Tailwind + shadcn/ui**, Recharts for the forecast curve

## How it works

1. A scheduled job (PgBoss, every 15 min) refreshes the WattTime token, pulls
   the latest MOER + 24h forecast for CAISO_NORTH, converts lbs CO₂/MWh →
   gCO₂/kWh, and upserts into Postgres.
2. A server query returns the current reading, the hourly-downsampled forecast,
   and the computed cleanest 2-hour window (sliding-average minimum over the
   forecast).
3. The client renders the live intensity, a clean-score dial, the
   cleanest-window callout, and the 24h curve.
4. Logged-in users can save a "notify me below N gCO₂/kWh" threshold (persisted;
   alerting is a planned follow-up).

## Local development

```bash
# 1. Register a free WattTime account (API-only, no web sign-up page):
curl -X POST https://api.watttime.org/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"you","password":"...","email":"you@example.com","org":"personal"}'

# 2. Copy env file and fill in credentials
cp .env.server.example .env.server

# 3. Start the database, run migrations, start dev server
wasp db start
wasp db migrate-dev
wasp start
```

The first data appears after the job's first run (up to 15 min). To trigger it
immediately in development, click the **POLL** button in the top-right of the
dashboard (dev-only), which calls the `triggerPoll` action. In production this
action is restricted to admins.

## Environment variables

Set in `.env.server`:

```env
WATTTIME_USERNAME=...
WATTTIME_PASSWORD=...
```

A free WattTime account works — no Pro subscription needed for CAISO_NORTH.

## Status

v1, shipped. Out of scope by design: multiple regions, notification delivery,
solar/self-generation modeling. The point was a focused, working, deployed
demonstration — not a platform.

---

## Portfolio note

> I came up through DevOps and infrastructure, and I wanted a focused piece that
> showed I can carry a full-stack feature end to end — and that I understand the
> energy domain I want to work in. Grid Carbon Clock pulls live
> marginal-emissions data from the California grid, stores it through a
> scheduled job, computes the cleanest window to run high-draw appliances, and
> serves it through an authenticated React app deployed on Fly.io.
>
> I deliberately scoped it to one grid region: WattTime's free tier gives real
> forecast data for CAISO Northern California, so rather than fake multi-region
> support I built it region-agnostic at the data layer and shipped the one
> region that worked for real. I'd rather demonstrate a working forecast than a
> broad mock. The whole thing is built on the marginal-emissions signal (MOER)
> rather than average intensity, because marginal is the signal that actually
> tells you whether shifting your usage reduces emissions — which is the kind of
> distinction the grid-software space cares about.
