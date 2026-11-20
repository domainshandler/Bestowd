import cron from 'node-cron'
import { db } from '../db.js'
import { computeNextOccurrence, startOfUtcDay } from './next-occurrence.js'
import { activeSubjectWhere } from './occasions.js'

export interface DueReminder {
  userId: string
  email: string
  groupId: string
  occasionId: string
  occasionName: string
  daysUntil: number
}

const DAY = 86_400_000

/**
 * Daily scan:
 * 1. Rolls passed occurrences forward. A new year of a recurring occasion starts NOT_STARTED with the card undone.
 * 2. Returns a reminder for every member of the occasion's group when it is due today, using the occasion's
 *    reminder days or the group default. Paused/archived families and archived people are skipped.
 * Push delivery comes with the MAUI app; for now due reminders are logged.
 */
export async function runReminderScan(now: Date = new Date()): Promise<DueReminder[]> {
  const today = startOfUtcDay(now)

  const passed = await db.occasion.findMany({ where: { nextOccurrence: { lt: today } } })
  for (const occasion of passed) {
    const next = computeNextOccurrence(occasion, now)
    await db.occasion.update({
      where: { id: occasion.id },
      data: { nextOccurrence: next, ...(next ? { status: 'NOT_STARTED', cardDone: false } : {}) },
    })
  }

  const occasions = await db.occasion.findMany({
    where: { nextOccurrence: { gte: today }, ...activeSubjectWhere },
    include: { group: { include: { memberships: { include: { user: { select: { email: true } } } } } } },
  })

  const due: DueReminder[] = []
  for (const occasion of occasions) {
    const daysUntil = Math.round((occasion.nextOccurrence!.getTime() - today.getTime()) / DAY)
    const days = occasion.reminderDays.length ? occasion.reminderDays : occasion.group.defaultReminderDays
    if (!days.includes(daysUntil)) continue
    for (const member of occasion.group.memberships) {
      due.push({ userId: member.userId, email: member.user.email, groupId: occasion.groupId, occasionId: occasion.id, occasionName: occasion.name, daysUntil })
      console.log(`[reminder] ${member.user.email}: "${occasion.name}" in ${daysUntil} day(s)`)
    }
  }
  return due
}

/** Registers the daily reminder scan at 9:00 server time. */
export function startReminderJob() {
  cron.schedule('0 9 * * *', () => {
    runReminderScan().catch((err) => console.error('[reminder] scan failed', err))
  })
  console.log('[reminder] Daily reminder job scheduled')
}
