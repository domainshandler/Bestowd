import cron from 'node-cron'
import { db } from '../db.js'

/**
 * Scans for upcoming events that fall within the reminder days and logs them.
 * This is the core logic extracted as a standalone function for testability.
 * Phase 1: logs to console. Phase 4: will send push notifications.
 */
export async function scanUpcomingEvents() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const events = await db.event.findMany({
    include: { contact: { include: { owner: true } } },
  })

  for (const event of events) {
    // Skip events with no nextOccurrence (one-time events)
    if (!event.nextOccurrence) {
      continue
    }

    const daysUntil = Math.ceil(
      (event.nextOccurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (event.reminderDays.includes(daysUntil)) {
      console.log(
        `[reminder] ${event.contact.owner.email}: "${event.name}" for ${event.contact.name} in ${daysUntil} day(s)`
      )
      // Phase 4: send push notification here
    }

    // Advance nextOccurrence for annual events that have passed
    if (event.nextOccurrence < today && event.recurrenceRule === 'annual') {
      const next = new Date(
        today.getFullYear() + 1,
        event.nextOccurrence.getMonth(),
        event.nextOccurrence.getDate()
      )
      await db.event.update({ where: { id: event.id }, data: { nextOccurrence: next } })
    }
  }
}

/**
 * Registers the daily reminder cron job.
 * Runs every day at 9:00 AM server time.
 */
export function startReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    await scanUpcomingEvents()
  })

  console.log('[reminder] Daily reminder job scheduled')
}
