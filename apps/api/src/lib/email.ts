import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Brisa <onboarding@resend.dev>'
const APP_STORE_URL = 'https://apps.apple.com/app/expo-go/id982107779'

function base(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brisa</title></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
        <!-- Header -->
        <tr><td style="background:#1E2E2A;padding:28px 32px;text-align:center;">
          <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="44" height="44" rx="10" fill="#1E2E2A"/>
            <path d="M8 16 Q15 11 22 16 Q29 21 36 16" stroke="#A8D5E2" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M8 22 Q16 16 24 22 Q30 26 36 22" stroke="#5BA4BE" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M8 28 Q14 23 20 28 Q28 34 36 28" stroke="#8BAF9A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          </svg>
          <p style="margin:10px 0 0;color:#fff;font-size:18px;font-weight:300;letter-spacing:0.3em;text-transform:uppercase;">BRISA</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #F3F4F6;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">Brisa · Dental Practice HR Platform</p>
          <p style="margin:6px 0 0;font-size:12px;color:#9CA3AF;">If you weren't expecting this email, you can safely ignore it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendStaffWelcome({
  to,
  firstName,
  practiceName,
  tempPassword,
}: {
  to: string
  firstName: string
  practiceName: string
  tempPassword: string
}) {
  const html = base(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1E2E2A;">Welcome to ${practiceName}!</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#4B5563;">Hi ${firstName}, your Brisa account is ready. Here are your login credentials for the mobile app.</p>

    <table width="100%" style="background:#F0FDF9;border:1.5px solid #A7F3D0;border-radius:12px;padding:20px;margin-bottom:24px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.06em;">Email</p>
        <p style="margin:4px 0 0;font-size:16px;color:#1E2E2A;font-weight:500;">${to}</p>
      </td></tr>
      <tr><td style="padding-top:16px;border-top:1px solid #D1FAE5;margin-top:16px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.06em;">Temporary Password</p>
        <p style="margin:4px 0 0;font-size:20px;color:#1E2E2A;font-weight:700;font-family:monospace;letter-spacing:0.05em;">${tempPassword}</p>
      </td></tr>
    </table>

    <h3 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1E2E2A;">How to get started</h3>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['Download the <strong>Brisa</strong> app on your phone (search for <em>Expo Go</em> in the App Store or Google Play).', 'Open the app and tap <strong>Sign In</strong>.', 'Enter your email and the temporary password above.', 'You\'ll be prompted to <strong>change your password</strong> on first login.'].map((step, i) => `
      <tr><td style="padding:8px 0;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:28px;height:28px;background:#1D9E75;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">${i + 1}</td>
          <td style="padding-left:12px;font-size:14px;color:#374151;vertical-align:middle;">${step}</td>
        </tr></table>
      </td></tr>`).join('')}
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">Keep this email somewhere safe until you've changed your password. Questions? Reach out to your practice admin.</p>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Brisa login for ${practiceName}`,
    html,
  })
}

export async function sendPasswordReset({
  to,
  firstName,
  practiceName,
  tempPassword,
}: {
  to: string
  firstName: string
  practiceName: string
  tempPassword: string
}) {
  const html = base(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1E2E2A;">Your password has been reset</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#4B5563;">Hi ${firstName}, your ${practiceName} admin has reset your Brisa password. Use the credentials below to log back in.</p>

    <table width="100%" style="background:#F0FDF9;border:1.5px solid #A7F3D0;border-radius:12px;padding:20px;margin-bottom:24px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 0;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.06em;">Email</p>
        <p style="margin:4px 0 0;font-size:16px;color:#1E2E2A;font-weight:500;">${to}</p>
      </td></tr>
      <tr><td style="padding-top:16px;border-top:1px solid #D1FAE5;margin-top:16px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:0.06em;">New Temporary Password</p>
        <p style="margin:4px 0 0;font-size:20px;color:#1E2E2A;font-weight:700;font-family:monospace;letter-spacing:0.05em;">${tempPassword}</p>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#374151;">Open the Brisa app, sign in with the above credentials, and you'll be prompted to set a new password.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">If you didn't expect this reset, contact your practice admin immediately.</p>
  `)

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Brisa password has been reset — ${practiceName}`,
    html,
  })
}
