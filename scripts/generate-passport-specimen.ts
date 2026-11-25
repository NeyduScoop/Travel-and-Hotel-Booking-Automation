/**
 * Generates a SYNTHETIC passport data page (no real person) for the passport-upload OCR test, so CI never needs
 * the real ID kept in the git-ignored data/common/passport-images/. Regenerate: npm run passport:specimen
 *
 * Personal data = the canonical fictional lead adult in data/common/wakanow.test-data.json. The machine-readable
 * zone (MRZ) follows ICAO 9303 TD3 (two 44-character lines with check digits), which is what OCR engines read.
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import { leadAdult } from '../data/common/passengers.data';

const OUT_DIR = path.resolve(__dirname, '../data/common/passport-specimen');
export const SPECIMEN_IMAGE = path.join(OUT_DIR, 'specimen-passport.jpg');

const ISO3: Record<string, string> = { Nigeria: 'NGA', Ghana: 'GHA', Kenya: 'KEN', 'United Kingdom': 'GBR' };

function checkDigit(s: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (const [i, ch] of [...s].entries()) {
    const v = ch === '<' ? 0 : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 55;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n);

export function mrz(t = leadAdult): [string, string] {
  const nat = ISO3[t.nationality] ?? t.nationality.slice(0, 3).toUpperCase();
  const issuer = ISO3[t.issuingCountry ?? t.nationality] ?? nat;
  const name = `${t.lastName.toUpperCase().replace(/[^A-Z]/g, '<')}<<${t.firstName.toUpperCase().replace(/[^A-Z]/g, '<')}`;
  const line1 = pad(`P<${issuer}${name}`, 44);
  const doc = pad(t.passportNumber.toUpperCase(), 9);
  const dob = yymmdd(t.dateOfBirth);
  const exp = yymmdd(t.passportExpiryDate);
  const sex = t.gender === 'Female' ? 'F' : 'M';
  const personal = '<'.repeat(14);
  const docCd = checkDigit(doc);
  const dobCd = checkDigit(dob);
  const expCd = checkDigit(exp);
  const perCd = checkDigit(personal);
  const composite = checkDigit(`${doc}${docCd}${dob}${dobCd}${exp}${expCd}${personal}${perCd}`);
  const line2 = `${doc}${docCd}${nat}${dob}${dobCd}${sex}${exp}${expCd}${personal}${perCd}${composite}`;
  return [line1, line2];
}

function html(): string {
  const t = leadAdult;
  const [l1, l2] = mrz(t);
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
  const row = (label: string, value: string) => `<div class="f"><span>${label}</span><b>${value}</b></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#fff}
  .page{width:1250px;height:880px;position:relative;background:linear-gradient(135deg,#eef4ea,#dfe9f3);font-family:Arial,Helvetica,sans-serif;color:#111;overflow:hidden}
  h1{margin:0;padding:28px 40px 6px;font-size:30px;letter-spacing:2px}
  h2{margin:0;padding:0 40px;font-size:18px;color:#333;font-weight:normal}
  .photo{position:absolute;left:40px;top:120px;width:300px;height:380px;background:#c9d3dc;border:2px solid #889;display:flex;align-items:center;justify-content:center;font-size:22px;color:#556}
  .data{position:absolute;left:380px;top:120px;width:820px;display:grid;grid-template-columns:1fr 1fr;gap:14px 30px}
  .f span{display:block;font-size:15px;color:#444} .f b{font-size:26px;letter-spacing:1px}
  .mrz{position:absolute;left:30px;bottom:40px;font-family:"OCR B","OCR-B","Courier New",monospace;font-size:40px;letter-spacing:2px;line-height:62px;font-weight:bold}
  .wm{position:absolute;left:330px;top:300px;font-size:150px;color:rgba(200,0,0,.13);transform:rotate(-18deg);font-weight:bold}
  </style></head><body><div class="page">
  <h1>PASSPORT</h1><h2>SPECIMEN - SYNTHETIC TEST DOCUMENT - NOT VALID FOR TRAVEL</h2>
  <div class="photo">NO PHOTO</div>
  <div class="data">
  ${row('Type', 'P')}${row('Passport No.', t.passportNumber.toUpperCase())}
  ${row('Surname', t.lastName.toUpperCase())}${row('Given Names', t.firstName.toUpperCase())}
  ${row('Nationality', t.nationality.toUpperCase())}${row('Sex', t.gender === 'Female' ? 'F' : 'M')}
  ${row('Date of Birth', d(t.dateOfBirth))}${row('Place of Birth', 'LAGOS')}
  ${row('Date of Issue', d('2025-05-26'))}${row('Date of Expiry', d(t.passportExpiryDate))}
  </div>
  <div class="wm">SPECIMEN</div>
  <div class="mrz">${l1.replace(/</g, '&lt;')}<br>${l2.replace(/</g, '&lt;')}</div>
  </div></body></html>`;
}

export async function generatePassportSpecimen(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1250, height: 880 } });
  await page.setContent(html());
  await page.locator('.page').screenshot({ path: SPECIMEN_IMAGE, type: 'jpeg', quality: 92 });
  await browser.close();
  console.log(`Wrote ${path.relative(process.cwd(), SPECIMEN_IMAGE)}\nMRZ:\n${mrz().join('\n')}`);
}

if (require.main === module) void generatePassportSpecimen();
