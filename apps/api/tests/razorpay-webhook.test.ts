import { createHmac } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { env } from '../src/config/env.js';
import { verifyWebhookSignature } from '../src/modules/fees/razorpay.js';

describe('Razorpay webhook verification',()=>{it('verifies the signature over exact raw bytes',()=>{const raw=Buffer.from('{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test"}}}}');const signature=createHmac('sha256',env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex');expect(verifyWebhookSignature(raw,signature)).toBe(true);expect(verifyWebhookSignature(Buffer.from(`${raw.toString()} `),signature)).toBe(false)});it('rejects malformed signatures',()=>{expect(verifyWebhookSignature(Buffer.from('{}'),'not-a-signature')).toBe(false)})});
