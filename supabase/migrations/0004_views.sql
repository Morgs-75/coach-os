create or replace view public.finance_monthly as
select
  org_id,
  to_char(date_trunc('month', event_date), 'YYYY-MM') as period,
  sum(case when amount_cents > 0 then amount_cents else 0 end) as cash_in_cents,
  sum(case when amount_cents < 0 then -amount_cents else 0 end) as cash_out_cents,
  sum(amount_cents) as net_cents,
  sum(case when type='FEE' then -amount_cents else 0 end) as fees_cents,
  sum(case when type='PLATFORM_FEE' then -amount_cents else 0 end) as platform_fees_cents,
  sum(case when type='REFUND' then -amount_cents else 0 end) as refunds_cents,
  sum(case when type='PAYOUT' then abs(amount_cents) else 0 end) as payouts_cents
from public.money_events
group by org_id, date_trunc('month', event_date);
