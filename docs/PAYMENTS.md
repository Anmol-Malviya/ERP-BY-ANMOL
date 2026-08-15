# Fees and payment integrity

## Manual collection
Cash, UPI, card-terminal and bank collections require a client-generated idempotency key. The payment row is created before the invoice ledger mutation. Invoice updates use a durable `appliedPaymentKeys` set, so retries cannot apply the same collection twice.

## Online payment flow
1. An authorized Student/Parent requests a Razorpay order for an invoice inside their object-level scope.
2. The API reserves that invoice balance and creates a local pending payment intent.
3. Checkout receives only the public key, order id and amount; provider secrets stay server-side.
4. Browser verification checks the Checkout HMAC and fetches the provider payment before applying the ledger.
5. Browser verification is not the only completion path. Signed provider webhooks and scheduled reconciliation can also finalize a captured payment.

## Webhooks
`POST /api/webhooks/razorpay` receives the exact raw JSON body in an encapsulated Fastify parser. The API verifies `X-Razorpay-Signature` before JSON parsing, stores a SHA-256 payload hash, deduplicates using `x-razorpay-event-id`, and queues processing. Webhook handlers do not assume event ordering. A failed payment event does not immediately release the reserved invoice balance because a later retry can still produce a captured payment.

The worker processes durable `payment.captured`, `order.paid`, payment-failure and refund events through secret internal API endpoints. Ledger writes remain idempotent via the local payment key.

## Reconciliation
BullMQ Job Schedulers create a reconciliation job every five minutes. The reconciliation path fetches provider payments for pending orders and finalizes any matching captured payment. It also checks PROCESSING provider refunds. This covers missed browser callbacks and delayed or retried webhook delivery.

## Refunds
Refund requests reserve refundable balance to prevent cumulative requests above the original payment. For Razorpay, creating a refund moves the local refund into PROCESSING. Local refunded totals are changed only after the provider reports/fetches `processed`; `failed` releases the reserved refund balance. Manual refund processing remains an explicit Accounts action.

## Production configuration
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are server-only.
- `RAZORPAY_WEBHOOK_SECRET` is separate from API credentials and must match the Dashboard webhook configuration.
- Configure events for `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, and `refund.failed`.
- Keep the webhook URL publicly reachable over HTTPS while every school/business API remains authenticated.

Before live keys are enabled, exercise payment success, failure+retry, duplicate webhook, out-of-order webhook, user cancellation, missed browser callback, processed refund and failed refund scenarios in Razorpay test mode.
