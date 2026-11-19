import cron from 'node-cron'

/**
 * Placeholder while the data model is realigned; the v1 occasion scan replaces this
 * (plan 2026-11-18-data-model-realignment-api.md, Task 10).
 */
export async function scanUpcomingEvents(): Promise<[]> {
  return []
}

export function startReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    await scanUpcomingEvents()
  })

  console.log('[reminder] Daily reminder job scheduled')
}
