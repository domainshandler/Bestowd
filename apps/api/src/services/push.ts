import { JWT } from 'google-auth-library'
import { db } from '../db.js'
import type { DueReminder } from './reminder-job.js'

export interface PushMessage {
  title: string
  body: string
  /** Strings only (FCM data payload), e.g. where a tap should open. */
  data: Record<string, string>
}

export type SendResult = 'sent' | 'invalid-token' | 'failed'

export interface PushSender {
  send(token: string, message: PushMessage): Promise<SendResult>
}

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

/** Sends through the FCM HTTP v1 API (Android directly, iOS via APNs) using a Firebase service account. */
export function createFcmSender(serviceAccountJson: string, fetchImpl: typeof fetch = fetch): PushSender {
  const account = JSON.parse(serviceAccountJson) as ServiceAccount
  const auth = new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })
  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`

  return {
    async send(token, message) {
      const { token: accessToken } = await auth.getAccessToken()
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title: message.title, body: message.body }, data: message.data } }),
      })
      if (res.ok) return 'sent'
      // FCM reports a stale or wrong token as 404 UNREGISTERED or 400 INVALID_ARGUMENT.
      if (res.status === 404 || res.status === 400) return 'invalid-token'
      return 'failed'
    },
  }
}

/** For environments without FCM credentials: logs instead of sending. */
export const loggingSender: PushSender = {
  async send(_token, message) {
    console.info(`[push] ${message.title}: ${message.body}`)
    return 'sent'
  },
}

/** Sends each reminder to every device of its user and drops tokens FCM rejects. */
export async function deliverReminders(
  reminders: DueReminder[],
  sender: PushSender,
): Promise<{ sent: number; removed: number; failed: number }> {
  const userIds = [...new Set(reminders.map((r) => r.userId))]
  const devices = userIds.length ? await db.device.findMany({ where: { userId: { in: userIds } } }) : []
  const stats = { sent: 0, removed: 0, failed: 0 }
  const removed = new Set<string>()
  for (const r of reminders) {
    for (const d of devices.filter((x) => x.userId === r.userId && !removed.has(x.id))) {
      const result = await sender.send(d.token, { title: r.title, body: r.body, data: r.data }).catch((): SendResult => 'failed')
      if (result === 'sent') stats.sent += 1
      else if (result === 'failed') stats.failed += 1
      else {
        await db.device.deleteMany({ where: { id: d.id } })
        removed.add(d.id)
        stats.removed += 1
      }
    }
  }
  return stats
}
