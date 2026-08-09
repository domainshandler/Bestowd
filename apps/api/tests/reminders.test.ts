import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createTestApp, createTestUser } from './helpers.js'
import { db } from '../src/db.js'
import { scanUpcomingEvents } from '../src/services/reminder-job.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let userId: string
let contactId: string

beforeAll(async () => {
  app = await createTestApp()
  const result = await createTestUser(app)
  userId = result.user.id
  const contact = await db.contact.create({ data: { ownerId: userId, name: 'Alice' } })
  contactId = contact.id
})

afterAll(async () => {
  // Clean up events first (FK: events -> contacts), then contacts, then users
  await db.event.deleteMany({ where: { contact: { ownerId: userId } } })
  await db.contact.deleteMany({ where: { ownerId: userId } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('scanUpcomingEvents', () => {
  it('logs reminders for events within reminder days', async () => {
    // Create an event with nextOccurrence 7 days from now
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const event = await db.event.create({
      data: {
        contactId,
        type: 'birthday',
        name: "Alice's Birthday",
        date: new Date('1990-01-15'),
        recurrenceRule: 'annual',
        reminderDays: [7, 1],
        nextOccurrence: nextWeek,
      },
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await scanUpcomingEvents()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`[reminder]`)
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Alice's Birthday`)
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Alice`)
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`7 day(s)`)
    )

    consoleSpy.mockRestore()
    await db.event.delete({ where: { id: event.id } })
  })

  it('does not log reminders for events outside reminder days', async () => {
    // Create an event with nextOccurrence 30 days from now, but reminderDays is [7, 1]
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in30Days = new Date(today)
    in30Days.setDate(in30Days.getDate() + 30)

    const event = await db.event.create({
      data: {
        contactId,
        type: 'anniversary',
        name: 'Anniversary',
        date: new Date('2000-06-20'),
        recurrenceRule: 'annual',
        reminderDays: [7, 1],
        nextOccurrence: in30Days,
      },
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await scanUpcomingEvents()

    const anniversaryLogs = consoleSpy.mock.calls.filter(
      call => call[0].includes('Anniversary')
    )
    expect(anniversaryLogs).toHaveLength(0)

    consoleSpy.mockRestore()
    await db.event.delete({ where: { id: event.id } })
  })

  it('skips events with no nextOccurrence', async () => {
    // Create a one-time event with null nextOccurrence
    const event = await db.event.create({
      data: {
        contactId,
        type: 'custom',
        name: 'One-time Event',
        date: new Date('2027-12-25'),
        recurrenceRule: 'once',
        reminderDays: [7],
        nextOccurrence: null,
      },
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await scanUpcomingEvents()

    const oneTimeLogs = consoleSpy.mock.calls.filter(
      call => call[0].includes('One-time Event')
    )
    expect(oneTimeLogs).toHaveLength(0)

    consoleSpy.mockRestore()
    await db.event.delete({ where: { id: event.id } })
  })

  it('advances nextOccurrence for annual events that have passed', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const event = await db.event.create({
      data: {
        contactId,
        type: 'birthday',
        name: "Bob's Birthday",
        date: new Date('1985-02-28'),
        recurrenceRule: 'annual',
        reminderDays: [7, 1],
        nextOccurrence: yesterday,
      },
    })

    await scanUpcomingEvents()

    const updated = await db.event.findUnique({ where: { id: event.id } })
    expect(updated?.nextOccurrence).not.toEqual(yesterday)
    expect(updated?.nextOccurrence?.getFullYear()).toBe(today.getFullYear() + 1)

    await db.event.delete({ where: { id: event.id } })
  })

  it('does not advance nextOccurrence for non-annual events', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const event = await db.event.create({
      data: {
        contactId,
        type: 'custom',
        name: 'One-time Milestone',
        date: new Date('2026-01-01'),
        recurrenceRule: 'once',
        reminderDays: [7, 1],
        nextOccurrence: yesterday,
      },
    })

    const eventBefore = await db.event.findUnique({ where: { id: event.id } })
    const originalOccurrence = eventBefore?.nextOccurrence

    await scanUpcomingEvents()

    const eventAfter = await db.event.findUnique({ where: { id: event.id } })
    expect(eventAfter?.nextOccurrence).toEqual(originalOccurrence)

    await db.event.delete({ where: { id: event.id } })
  })

  it('logs multiple reminders for different events', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    const event1 = await db.event.create({
      data: {
        contactId,
        type: 'birthday',
        name: 'Event 1',
        date: new Date('1990-03-15'),
        recurrenceRule: 'annual',
        reminderDays: [7],
        nextOccurrence: in7Days,
      },
    })

    const event2 = await db.event.create({
      data: {
        contactId,
        type: 'anniversary',
        name: 'Event 2',
        date: new Date('2000-05-20'),
        recurrenceRule: 'annual',
        reminderDays: [7],
        nextOccurrence: in7Days,
      },
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await scanUpcomingEvents()

    const event1Logs = consoleSpy.mock.calls.filter(call => call[0].includes('Event 1'))
    const event2Logs = consoleSpy.mock.calls.filter(call => call[0].includes('Event 2'))

    expect(event1Logs.length).toBeGreaterThan(0)
    expect(event2Logs.length).toBeGreaterThan(0)

    consoleSpy.mockRestore()
    await db.event.delete({ where: { id: event1.id } })
    await db.event.delete({ where: { id: event2.id } })
  })
})
