import cron from 'node-cron'
import type { OccasionStatus } from '@prisma/client'
import { db } from '../db.js'
import { env } from '../config.js'
import { addDays, computeNextOccurrence, startOfUtcDay } from './next-occurrence.js'
import { activeSubjectWhere } from './occasions.js'
import { createFcmSender, deliverReminders, loggingSender } from './push.js'

export type ReminderKind = 'OCCASION' | 'BUY' | 'CARD' | 'THANK_YOU'

export interface DueReminder {
  kind: ReminderKind
  userId: string
  email: string
  groupId: string
  /** The occasion, or for THANK_YOU the occasion the gift was for (if any). */
  occasionId: string | null
  giftEntryId: string | null
  occasionName: string
  daysUntil: number
  title: string
  body: string
  /** Where a tap should open, for the app. */
  data: Record<string, string>
}

const DAY = 86_400_000
export const BUY_REMINDER_DAYS = 7
export const CARD_REMINDER_DAYS = 3

function inDays(n: number): string {
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`
}

/**
 * Which reminders an occasion gets today. The regular reminder says "needs a gift" while nothing is
 * planned; a separate buy reminder goes out a week before only if that day isn't already a reminder day.
 */
export function occasionReminderKinds(o: {
  daysUntil: number; reminderDays: number[]; status: OccasionStatus; needsCard: boolean; cardDone: boolean
}): ReminderKind[] {
  const kinds: ReminderKind[] = []
  if (o.reminderDays.includes(o.daysUntil)) kinds.push('OCCASION')
  else if (o.daysUntil === BUY_REMINDER_DAYS && o.status === 'NOT_STARTED') kinds.push('BUY')
  if (o.daysUntil === CARD_REMINDER_DAYS && o.needsCard && !o.cardDone) kinds.push('CARD')
  return kinds
}

export function occasionMessage(kind: ReminderKind, o: { name: string; daysUntil: number; status: OccasionStatus }): { title: string; body: string } {
  switch (kind) {
    case 'BUY':
      return { title: o.name, body: `${o.name} is in a week and nothing is planned yet. Time to pick a gift.` }
    case 'CARD':
      return { title: `Card for ${o.name}`, body: `${o.name} is ${inDays(o.daysUntil)}. Don't forget the card.` }
    default:
      return {
        title: o.name,
        body: `${o.name} is ${inDays(o.daysUntil)}${o.status === 'NOT_STARTED' ? ' and still needs a gift' : ''}.`,
      }
  }
}

/**
 * Daily scan:
 * 1. Rolls passed occurrences forward. A new year of a recurring occasion starts NOT_STARTED with the card undone.
 * 2. Occasion reminders (the occasion's reminder days or the group default), buy reminders a week out when nothing
 *    is planned, and card reminders 3 days out — for every member of the occasion's group. Paused/archived families
 *    and archived people are skipped.
 * 3. Thank-you reminders on the due date of received gifts not yet thanked.
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

  const due: DueReminder[] = []
  const members = { memberships: { include: { user: { select: { email: true } } } } }

  const occasions = await db.occasion.findMany({
    where: { nextOccurrence: { gte: today }, ...activeSubjectWhere },
    include: { group: { include: members } },
  })
  for (const occasion of occasions) {
    const daysUntil = Math.round((occasion.nextOccurrence!.getTime() - today.getTime()) / DAY)
    const reminderDays = occasion.reminderDays.length ? occasion.reminderDays : occasion.group.defaultReminderDays
    for (const kind of occasionReminderKinds({ ...occasion, daysUntil, reminderDays })) {
      const message = occasionMessage(kind, { ...occasion, daysUntil })
      const data = { kind, occasionId: occasion.id, ...(occasion.personId ? { personId: occasion.personId } : { familyId: occasion.familyId! }) }
      for (const m of occasion.group.memberships) {
        due.push({ kind, userId: m.userId, email: m.user.email, groupId: occasion.groupId, occasionId: occasion.id, giftEntryId: null, occasionName: occasion.name, daysUntil, ...message, data })
      }
    }
  }

  const thanks = await db.giftEntry.findMany({
    where: { direction: 'RECEIVED', thankYouSent: false, thankYouDueAt: { gte: today, lt: addDays(today, 1) } },
    include: {
      group: { include: members },
      person: { select: { name: true } },
      family: { select: { name: true } },
      occasion: { select: { name: true } },
    },
  })
  for (const g of thanks) {
    const from = g.person?.name ?? g.family?.name ?? 'them'
    const data = { kind: 'THANK_YOU', giftEntryId: g.id, ...(g.personId ? { personId: g.personId } : { familyId: g.familyId! }) }
    for (const m of g.group.memberships) {
      due.push({
        kind: 'THANK_YOU', userId: m.userId, email: m.user.email, groupId: g.groupId, occasionId: g.occasionId, giftEntryId: g.id,
        occasionName: g.occasion?.name ?? '', daysUntil: 0,
        title: 'Thank-you due', body: `Send a thank-you to ${from} for the ${g.title}.`, data,
      })
    }
  }

  for (const r of due) console.log(`[reminder] ${r.email}: ${r.body}`)
  return due
}

/** Registers the daily reminder scan at 9:00 server time and delivers by push when FCM is configured. */
export function startReminderJob() {
  const sender = env.FCM_SERVICE_ACCOUNT ? createFcmSender(env.FCM_SERVICE_ACCOUNT) : loggingSender
  cron.schedule('0 9 * * *', () => {
    runReminderScan()
      .then((due) => deliverReminders(due, sender))
      .then((stats) => console.log(`[reminder] push sent ${stats.sent}, removed ${stats.removed} stale tokens, ${stats.failed} failed`))
      .catch((err) => console.error('[reminder] scan failed', err))
  })
  console.log(`[reminder] Daily reminder job scheduled (${env.FCM_SERVICE_ACCOUNT ? 'push via FCM' : 'logging only'})`)
}
