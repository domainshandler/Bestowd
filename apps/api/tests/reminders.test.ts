import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createTestApp, createTestUser, cleanupUser } from './helpers.js'
import { db } from '../src/db.js'
import { occasionReminderKinds, runReminderScan } from '../src/services/reminder-job.js'
import { deliverReminders, type PushSender } from '../src/services/push.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let a: Awaited<ReturnType<typeof createTestUser>>
let b: Awaited<ReturnType<typeof createTestUser>>
let mia: string

const now = new Date('2026-11-18T09:00:00Z')
const day = (offset: number) => new Date(Date.UTC(2026, 10, 18 + offset))

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  app = await createTestApp()
  a = await createTestUser(app)
  b = await createTestUser(app)
  await db.groupMembership.create({ data: { groupId: a.groupId, userId: b.user.id, role: 'MEMBER' } })
  mia = (await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Mia' } })).id
})

afterAll(async () => {
  await cleanupUser(a.user.id)
  await cleanupUser(b.user.id)
  await app.close()
  vi.restoreAllMocks()
})

async function occasion(name: string, data: Record<string, unknown>) {
  return db.occasion.create({ data: { groupId: a.groupId, personId: mia, type: 'BIRTHDAY', name, date: day(0), ...data } })
}
const remindersFor = async (id: string) => (await runReminderScan(now)).filter((r) => r.occasionId === id)

describe('runReminderScan', () => {
  it('reminds every group member on a default reminder day (14 and 3)', async () => {
    const occ = await occasion('In 14 days', { nextOccurrence: day(14) })
    const due = await remindersFor(occ.id)
    expect(due.map((r) => r.userId).sort()).toEqual([a.user.id, b.user.id].sort())
    expect(due[0]).toMatchObject({ daysUntil: 14, groupId: a.groupId, occasionName: 'In 14 days' })
  })

  it("uses the occasion's own reminder days instead of the default", async () => {
    const at14 = await occasion('Own days, 14 out', { nextOccurrence: day(14), reminderDays: [7] })
    const at7 = await occasion('Own days, 7 out', { nextOccurrence: day(7), reminderDays: [7] })
    expect(await remindersFor(at14.id)).toHaveLength(0)
    expect(await remindersFor(at7.id)).toHaveLength(2)
  })

  it('skips paused families and archived people', async () => {
    const paused = await db.family.create({ data: { groupId: a.groupId, name: 'Paused', status: 'PAUSED' } })
    const famOcc = await db.occasion.create({
      data: { groupId: a.groupId, familyId: paused.id, type: 'HOLIDAY', name: 'Paused', date: day(3), nextOccurrence: day(3) },
    })
    const gone = await db.person.create({ data: { groupId: a.groupId, familyId: a.householdId, name: 'Gone', archivedAt: new Date() } })
    const personOcc = await db.occasion.create({
      data: { groupId: a.groupId, personId: gone.id, type: 'BIRTHDAY', name: 'Archived', date: day(3), nextOccurrence: day(3) },
    })
    expect(await remindersFor(famOcc.id)).toHaveLength(0)
    expect(await remindersFor(personOcc.id)).toHaveLength(0)
  })

  it('rolls a passed recurring occasion to next year and resets its status and card', async () => {
    const occ = await occasion('Yesterday', {
      date: new Date('2019-11-17'),
      nextOccurrence: day(-1),
      status: 'GIVEN',
      needsCard: true,
      cardDone: true,
    })
    await runReminderScan(now)
    const after = await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })
    expect(after.nextOccurrence).toEqual(new Date('2027-11-17T00:00:00Z'))
    expect(after).toMatchObject({ status: 'NOT_STARTED', cardDone: false })
  })

  it('clears nextOccurrence of a passed one-off and keeps its status', async () => {
    const occ = await occasion('Done party', {
      type: 'ONE_OFF',
      recursAnnually: false,
      date: day(-2),
      nextOccurrence: day(-2),
      status: 'GIVEN',
    })
    await runReminderScan(now)
    const after = await db.occasion.findUniqueOrThrow({ where: { id: occ.id } })
    expect(after.nextOccurrence).toBeNull()
    expect(after.status).toBe('GIVEN')
  })
})

describe('occasionReminderKinds', () => {
  const base = { reminderDays: [14, 3], status: 'NOT_STARTED' as const, needsCard: false, cardDone: false }
  it('sends the regular reminder on reminder days', () => {
    expect(occasionReminderKinds({ ...base, daysUntil: 14 })).toEqual(['OCCASION'])
    expect(occasionReminderKinds({ ...base, daysUntil: 10 })).toEqual([])
  })
  it('adds a buy reminder a week out only when nothing is planned and 7 is not a reminder day', () => {
    expect(occasionReminderKinds({ ...base, daysUntil: 7 })).toEqual(['BUY'])
    expect(occasionReminderKinds({ ...base, daysUntil: 7, status: 'IDEA_SAVED' })).toEqual([])
    expect(occasionReminderKinds({ ...base, daysUntil: 7, reminderDays: [7] })).toEqual(['OCCASION'])
  })
  it('adds a card reminder 3 days out while the card is not done', () => {
    expect(occasionReminderKinds({ ...base, daysUntil: 3, needsCard: true })).toEqual(['OCCASION', 'CARD'])
    expect(occasionReminderKinds({ ...base, daysUntil: 3, needsCard: true, cardDone: true })).toEqual(['OCCASION'])
  })
})

describe('buy, card and thank-you reminders', () => {
  it('sends a buy reminder a week before an unplanned occasion, saying it needs a gift', async () => {
    const occ = await occasion('Week out', { nextOccurrence: day(7) })
    const due = await remindersFor(occ.id)
    expect(due).toHaveLength(2)
    expect(due[0]).toMatchObject({ kind: 'BUY', title: 'Week out', data: { kind: 'BUY', occasionId: occ.id, personId: mia } })
  })

  it('mentions a missing gift in the regular reminder and sends a card reminder', async () => {
    const occ = await occasion('Three days', { nextOccurrence: day(3), needsCard: true })
    const due = await remindersFor(occ.id)
    expect(due.map((r) => r.kind).sort()).toEqual(['CARD', 'CARD', 'OCCASION', 'OCCASION'])
    expect(due.find((r) => r.kind === 'OCCASION')!.body).toBe('Three days is in 3 days and still needs a gift.')
  })

  it('reminds every member to send a thank-you on the due date', async () => {
    const g = await db.giftEntry.create({
      data: {
        groupId: a.groupId,
        createdById: a.user.id,
        direction: 'RECEIVED',
        title: 'cookie tin',
        date: day(-14),
        personId: mia,
        thankYouDueAt: day(0),
      },
    })
    await db.giftEntry.create({
      data: {
        groupId: a.groupId,
        createdById: a.user.id,
        direction: 'RECEIVED',
        title: 'already thanked',
        date: day(-14),
        personId: mia,
        thankYouDueAt: day(0),
        thankYouSent: true,
      },
    })
    const due = (await runReminderScan(now)).filter((r) => r.kind === 'THANK_YOU' && r.groupId === a.groupId)
    expect(due).toHaveLength(2)
    expect(due[0]).toMatchObject({ giftEntryId: g.id, body: 'Send a thank-you to Mia for the cookie tin.' })
  })
})

describe('deliverReminders', () => {
  it('sends to each device of the user and removes tokens FCM rejects', async () => {
    await db.device.create({ data: { userId: a.user.id, platform: 'ANDROID', token: 'good-token' } })
    await db.device.create({ data: { userId: a.user.id, platform: 'IOS', token: 'stale-token' } })
    const sent: string[] = []
    const sender: PushSender = {
      async send(token) {
        sent.push(token)
        return token === 'stale-token' ? 'invalid-token' : 'sent'
      },
    }
    const reminder = {
      kind: 'OCCASION' as const,
      userId: a.user.id,
      email: '',
      groupId: a.groupId,
      occasionId: null,
      giftEntryId: null,
      occasionName: 'x',
      daysUntil: 3,
      title: 't',
      body: 'b',
      data: {},
    }
    const stats = await deliverReminders([reminder, reminder], sender)
    expect(stats).toEqual({ sent: 2, removed: 1, failed: 0 })
    expect(sent.filter((t) => t === 'stale-token')).toHaveLength(1)
    expect(await db.device.findUnique({ where: { token: 'stale-token' } })).toBeNull()
  })
})
