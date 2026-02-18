# SMS Integration Setup Guide

This guide explains how to set up and use the SMS communications infrastructure for Coach OS.

## Overview

The SMS system provides three notification types:
1. **Booking Confirmation** - Sent immediately when a session is booked
2. **Session Reminder** - Sent before the session (default: 24 hours)
3. **Feedback Request** - Sent after the session (default: 2 hours)

## Architecture

- **Queue-based sending** using Postgres with `SELECT FOR UPDATE SKIP LOCKED`
- **Worker mechanism** via scheduled Edge Function (`sms-worker`) running every 2 minutes
- **Webhook handler** for Twilio delivery status callbacks
- **Multi-tenant isolation** with RLS policies
- **Retry logic** with exponential backoff (4 attempts max)
- **Quiet hours** enforcement (9 PM - 8 AM by default)
- **Rate limiting** per client and per org

## Database Setup

### 1. Run Migration

Apply the migration to create all required tables:

```bash
supabase migration up
```

This creates:
- `sms_templates` - Template management
- `sms_messages` - Message queue
- `sms_attempts` - Retry tracking
- `sms_events` - Webhook events
- `sms_suppression` - Opt-out list
- `sms_settings` - Per-org configuration

### 2. Add Columns to Bookings Table

The cron job expects these columns on the `bookings` table:

```sql
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS feedback_sent boolean DEFAULT false;
```

## Twilio Setup

### 1. Create Twilio Account

1. Sign up at [twilio.com](https://www.twilio.com)
2. Verify your phone number
3. Get your credentials from the Console:
   - Account SID (starts with `AC`)
   - Auth Token

### 2. Get a Phone Number or Messaging Service

**Option A: Buy a Phone Number** ($1-5/month)
1. Go to Phone Numbers → Buy a Number
2. Choose an SMS-capable number in your country
3. Copy the phone number in E.164 format (e.g., `+61412345678`)

**Option B: Create Messaging Service** (recommended for scale)
1. Go to Messaging → Services → Create Service
2. Add phone number(s) to the service
3. Copy the Messaging Service SID (starts with `MG`)

### 3. Configure Webhook

1. Go to your Phone Number or Messaging Service settings
2. Set **Status Callback URL** to:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/twilio-webhook
   ```
3. Enable **POST** method
4. Save

## Environment Variables

### Add to Supabase Secrets

```bash
# Global Twilio credentials (fallback if not set per-org)
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set TWILIO_AUTH_TOKEN=...

# Cron job authentication
supabase secrets set CRON_SECRET=<random-secret>

# Optional: Web app URL for feedback links
supabase secrets set WEBAPP_URL=https://yourapp.com
```

### Generate CRON_SECRET

```bash
openssl rand -base64 32
```

## Supabase Cron Jobs

### 1. SMS Worker (every 2 minutes)

Run this SQL in your Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'sms-worker',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/sms-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

### 2. SMS Reminders (daily at 8 AM)

```sql
SELECT cron.schedule(
  'sms-reminders',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/cron-sms-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

## Per-Org Configuration

### 1. Create SMS Settings for an Org

```sql
INSERT INTO public.sms_settings (
  org_id,
  twilio_account_sid,
  twilio_auth_token_encrypted,
  twilio_phone_number,
  enabled,
  send_booking_confirmations,
  send_session_reminders,
  send_feedback_requests,
  reminder_hours_before,
  feedback_hours_after,
  quiet_hours_start,
  quiet_hours_end,
  timezone
) VALUES (
  '<org-id>',
  'AC...',  -- Optional: org-specific Twilio Account SID
  '...',    -- Optional: org-specific Auth Token (should be encrypted)
  '+61412345678',  -- Or use twilio_messaging_service_sid instead
  true,     -- enabled
  true,     -- send_booking_confirmations
  true,     -- send_session_reminders
  true,     -- send_feedback_requests
  24,       -- reminder_hours_before
  2,        -- feedback_hours_after
  21,       -- quiet_hours_start (9 PM)
  8,        -- quiet_hours_end (8 AM)
  'Australia/Sydney'
);
```

### 2. Create SMS Templates

Create templates for each notification type:

```sql
-- Booking Confirmation
INSERT INTO public.sms_templates (
  org_id,
  template_key,
  name,
  body,
  variables_schema,
  is_active
) VALUES (
  '<org-id>',
  'booking_confirmation',
  'Booking Confirmation',
  'Hi {{client_name}}, your session with {{coach_name}} is confirmed for {{session_datetime}}. Location: {{location}}. Reply STOP to opt out.',
  '["client_name", "coach_name", "session_datetime", "location"]'::jsonb,
  true
);

-- Session Reminder
INSERT INTO public.sms_templates (
  org_id,
  template_key,
  name,
  body,
  variables_schema,
  is_active
) VALUES (
  '<org-id>',
  'session_reminder',
  'Session Reminder',
  'Hi {{client_name}}, reminder: your session is coming up on {{session_datetime}} at {{location}}. See you soon! - {{coach_name}}',
  '["client_name", "session_datetime", "location", "coach_name"]'::jsonb,
  true
);

-- Feedback Request
INSERT INTO public.sms_templates (
  org_id,
  template_key,
  name,
  body,
  variables_schema,
  is_active
) VALUES (
  '<org-id>',
  'feedback_request',
  'Feedback Request',
  'Hi {{client_name}}, thanks for your session with {{coach_name}}! How did it go? Share your feedback: {{feedback_link}}',
  '["client_name", "coach_name", "feedback_link"]'::jsonb,
  true
);
```

## Usage

### Sending Booking Confirmation (from your app)

```typescript
// After creating a booking
const response = await fetch(`${SUPABASE_URL}/functions/v1/sms-send`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    client_id: booking.client_id,
    template_key: "booking_confirmation",
    variables: {
      client_name: client.full_name.split(" ")[0],
      coach_name: org.name,
      session_datetime: format(booking.start_time, "PPpp"),
      location: booking.location_details || "TBD",
    },
    related_entity_type: "booking",
    related_entity_id: booking.id,
    idempotency_key: `booking-confirmation-${booking.id}`,
  }),
});
```

### Scheduled Messages

Reminders and feedback requests are automatically created by the `cron-sms-reminders` job based on:
- `sms_settings.reminder_hours_before` (default: 24 hours)
- `sms_settings.feedback_hours_after` (default: 2 hours)

## Monitoring

### Check Message Status

```sql
-- Recent messages
SELECT
  id,
  template_key,
  to_phone,
  status,
  scheduled_for,
  sent_at,
  delivered_at,
  error_message
FROM sms_messages
WHERE created_at >= now() - interval '24 hours'
ORDER BY created_at DESC;
```

### Delivery Rate

```sql
SELECT
  ROUND(100.0 * SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) / COUNT(*), 2) as delivery_rate
FROM sms_messages
WHERE sent_at >= now() - interval '24 hours';
```

### Failed Messages

```sql
SELECT
  error_code,
  COUNT(*) as count
FROM sms_messages
WHERE status = 'failed'
  AND failed_at >= now() - interval '7 days'
GROUP BY error_code
ORDER BY count DESC;
```

### Opt-outs

```sql
SELECT
  phone,
  reason,
  created_at
FROM sms_suppression
WHERE org_id = '<org-id>'
ORDER BY created_at DESC;
```

## Testing

### Local Testing with Ngrok

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Start ngrok:
   ```bash
   ngrok http 54321
   ```

3. Update Twilio webhook URL to ngrok URL:
   ```
   https://<ngrok-id>.ngrok.io/functions/v1/twilio-webhook
   ```

4. Send test SMS via API

### Test with Twilio Test Credentials

- Use verified phone numbers only
- No actual SMS charges
- Webhooks still work

## Troubleshooting

### Messages Stuck in "pending"

- Check if `queue_pending_sms()` function is working
- Verify `scheduled_for` is in the past
- Check cron job is running

### Messages Stuck in "queued"

- Check if `sms-worker` cron is running
- Check Twilio credentials are correct
- Check worker logs in Supabase Dashboard

### Webhook Not Updating Status

- Verify webhook URL is correct in Twilio
- Check webhook signature verification
- Check `sms_events` table for incoming events
- Ensure webhook handler has correct `TWILIO_AUTH_TOKEN`

### Rate Limit Errors

- Check `max_sms_per_client_per_day` in `sms_settings`
- Check `max_sms_per_hour` in `sms_settings`
- Review Twilio account limits

## Security Best Practices

1. **Never commit secrets** - Use Supabase Secrets or environment variables
2. **Verify Twilio signatures** - Already implemented in webhook handler
3. **Use HTTPS only** - Enforced by Supabase
4. **Encrypt auth tokens** - Store encrypted in `twilio_auth_token_encrypted`
5. **Respect opt-outs** - Automatically handled via `sms_suppression` table
6. **Rate limiting** - Enforced per client and per org

## Cost Estimation

**Twilio Costs** (as of 2024):
- SMS (Australia): ~$0.08 AUD per message
- Phone number: ~$1.50 AUD/month
- Messaging Service: Free (just need phone numbers)

**Example Monthly Cost for 10 Clients**:
- 10 clients × 4 sessions/month = 40 bookings
- 40 confirmations + 40 reminders + 40 feedback = 120 SMS
- 120 × $0.08 = **$9.60/month** (+ $1.50 phone number = **$11.10/month**)

## Support

For issues or questions:
1. Check Supabase logs in Dashboard → Edge Functions
2. Check `sms_events` and `sms_attempts` tables for delivery details
3. Review Twilio Console for API errors
4. Check cron job execution in Supabase Dashboard → Database → Cron Jobs
