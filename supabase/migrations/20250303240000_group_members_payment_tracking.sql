-- Track payment mapping for IntaSend (invoice_id/api_ref)
-- Allows webhook → group_members update even if api_ref is missing in the webhook payload.

alter table group_members add column if not exists payment_invoice_id text;
alter table group_members add column if not exists payment_api_ref text;

