# Fees and payment integrity

## Manual collection
Cash, UPI, card-terminal and bank collections require a client-generated idempotency key. The payment row is created before the invoice ledger mutation. Invoice updates use a durable `appliedPaymentKeys` set, so a retry or a crash after the ledger update cannot charge the invoice twice.

## Online payments
The Razorpay flow is intentionally server-authoritative:
1. Client requests an order for an invoice it is authorized to access.
2. The API reserves the invoice balance and creates a local pending payment intent.
3. The API creates the Razorpay Order; client receives only the public key, order id and amount.
4. After checkout, the API verifies the checkout HMAC signature.
5. The API fetches the payment from Razorpay and requires a captured payment whose order and amount match the local intent.
6. Only then is the school fee ledger updated using the same idempotent ledger mutation.

Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in production. The secret is never sent to the browser.

## Refunds
Refund requests reserve refundable balance, preventing multiple partial requests from exceeding the original payment. Razorpay refunds use the provider idempotency header; manual refunds are recorded through the same approval/process endpoint. Refund completion updates the payment's cumulative refunded amount.

## Remaining launch work
- Configure and test Razorpay webhooks using a raw-body signature verification endpoint.
- Reconcile pending payment intents and stale reservations with a scheduled worker.
- Run test-mode gateway scenarios for success, failure, user cancellation, webhook retry and delayed capture before enabling live keys.
