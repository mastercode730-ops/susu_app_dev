// Shared formatting for the subscription model (subscribe screen,
// Super Manager screens, "My Subscription").
import { fmtNum } from './format';

export const inr = (n) => (n === null || n === undefined ? '-' : `₹${fmtNum(n, 2)}`);

export const durText = (d) => {
  const n = parseInt(d, 10) || 0;
  if (n && n % 365 === 0) return n === 365 ? '1 year' : `${n / 365} years`;
  if (n && n % 30 === 0) return n === 30 ? '1 month' : `${n / 30} months`;
  return `${n} days`;
};

// DATE values arrive as UTC-midnight ISO strings holding the server's date.
export const subDate = (d) => {
  if (!d) return '-';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const subDateTime = (d) => {
  if (!d) return '-';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
};

// DaysLeft from the API is 0 on the last valid day.
export const daysLeftText = (daysLeft) => {
  const n = Number(daysLeft);
  if (n < 0) return `expired ${-n} day${n === -1 ? '' : 's'} ago`;
  if (n === 0) return 'expires today';
  return `${n + 1} days left`;
};

export function genPassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
