import nodemailer from 'nodemailer'
import { env } from '../config.js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
})

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function sendContactInvite(to: string, inviterName: string): Promise<void> {
  await transporter.sendMail({
    from: env.GMAIL_USER,
    to,
    subject: `${inviterName} invited you to Bestowd`,
    text: `${inviterName} added you as a gift-planning contact on Bestowd. Sign in with Google at ${env.WEB_APP_URL} to connect.`,
    html: `<p><strong>${escapeHtml(inviterName)}</strong> added you as a gift-planning contact on Bestowd.</p><p><a href="${escapeHtml(env.WEB_APP_URL)}">Sign in with Google</a> to connect.</p>`,
  })
}
