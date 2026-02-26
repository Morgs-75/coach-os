alter table booking_settings
  add column if not exists gst_registered boolean not null default false,
  add column if not exists pass_stripe_fees boolean not null default false;
