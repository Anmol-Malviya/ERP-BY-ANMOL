import { createHmac,timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

type RazorpayOrder={id:string;amount:number;amount_due:number;currency:string;receipt:string;status:string};
type RazorpayPayment={id:string;amount:number;currency:string;status:string;captured:boolean;order_id:string|null};
type RazorpayRefund={id:string;amount:number;payment_id:string;status?:string};

function credentials(){if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)throw new AppError(503,'PAYMENT_PROVIDER_UNAVAILABLE','Online payment provider is not configured');return{keyId:env.RAZORPAY_KEY_ID,keySecret:env.RAZORPAY_KEY_SECRET}}
async function api<T>(path:string,init:RequestInit={}){const{keyId,keySecret}=credentials();const response=await fetch(`https://api.razorpay.com/v1${path}`,{...init,headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,'Content-Type':'application/json',...(init.headers||{})}});const text=await response.text();let body:any={};try{body=text?JSON.parse(text):{}}catch{body={message:text}}if(!response.ok)throw new AppError(502,'PAYMENT_PROVIDER_ERROR',body?.error?.description||body?.error?.reason||body?.message||`Razorpay request failed (${response.status})`);return body as T}
export const razorpayPublicKey=()=>credentials().keyId;
export async function createOrder(amountPaise:number,receipt:string,notes:Record<string,string>){return api<RazorpayOrder>('/orders',{method:'POST',body:JSON.stringify({amount:amountPaise,currency:'INR',receipt:receipt.slice(0,40),notes})})}
export async function fetchPayment(paymentId:string){return api<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`)}
export async function createRefund(paymentId:string,amountPaise:number,idempotencyKey:string,receipt:string){return api<RazorpayRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`,{method:'POST',headers:{'X-Refund-Idempotency':idempotencyKey},body:JSON.stringify({amount:amountPaise,receipt:receipt.slice(0,40)})})}
export function verifyCheckoutSignature(orderId:string,paymentId:string,signature:string){const{keySecret}=credentials();const expected=createHmac('sha256',keySecret).update(`${orderId}|${paymentId}`).digest('hex');if(!/^[a-f0-9]{64}$/i.test(signature)||signature.length!==expected.length)return false;return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex'))}
export function toPaise(amount:number){const value=Number(amount);const paise=Math.round(value*100);if(!Number.isFinite(value)||value<=0||Math.abs(value*100-paise)>0.000001)throw new AppError(400,'INVALID_AMOUNT','Amount must be positive with at most two decimal places');return paise}
