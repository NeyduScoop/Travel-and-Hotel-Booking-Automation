import * as fs from 'fs';
import * as path from 'path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { secretValues } from '../utils/environment.utils';

type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'FLAKY';
/** Most specific first: a PRIME Flights test carries both @prime-flights and @prime. */
const MODULE_TAGS = ['@prime-flights', '@prime-hotels', '@affiliate', '@packages', '@flights', '@hotels', '@tours', '@visa', '@prime', '@travel-addons'];
const SUITE_TAGS = ['@e2e', '@smoke', '@regression'];

interface Row {
  id: string;
  title: string;
  project: string;
  module: string;
  suite: string;
  tags: string[];
  status: Status;
  durationMs: number;
  error?: string;
  blockedReason?: string;
  observations: string[];
  /** Payment route actually used (owner rule 2026-11-22: always recorded) and the booking it paid. */
  paymentRoute?: string;
  booking?: string;
}

/**
 * Writes test-results/execution-summary.{json,md} with PASS / FAIL / BLOCKED / SKIPPED counts
 * per module, and appends the Markdown to $GITHUB_STEP_SUMMARY when running in GitHub Actions.
 * BLOCKED = skipped with a `blocked` annotation (missing data, credentials or inventory).
 */
export default class SummaryReporter implements Reporter {
  private rows: Row[] = [];
  private readonly outputDir: string;
  private startedAt = new Date();
  private baseUrl = '';

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'test-results';
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date();
    this.baseUrl = String(config.metadata?.baseUrl ?? '');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const outcome = test.outcome();
    if (result.retry < test.results.length - 1 && outcome !== 'flaky') return; // only final attempt
    const blocked = test.annotations.find((a) => a.type === 'blocked');
    let status: Status;
    if (outcome === 'flaky') status = 'FLAKY';
    else if (result.status === 'skipped') status = blocked ? 'BLOCKED' : 'SKIPPED';
    else if (outcome === 'expected') status = 'PASS';
    else status = 'FAIL';
    const tags = test.tags;
    const row: Row = {
      id: test.id,
      title: test.titlePath().slice(3).join(' › '),
      project: test.parent.project()?.name ?? '',
      module: MODULE_TAGS.find((t) => tags.includes(t))?.slice(1) ?? 'common',
      suite: SUITE_TAGS.find((t) => tags.includes(t))?.slice(1) ?? 'other',
      tags,
      status,
      durationMs: result.duration,
      error: result.error?.message?.split('\n').slice(0, 3).join(' ').replace(/\u001b\[[0-9;]*m/g, ''),
      blockedReason: blocked?.description,
      paymentRoute: test.annotations.filter((a) => a.type === 'payment-route').map((a) => a.description).join(' ⟶ then: ') || undefined,
      booking: test.annotations.filter((a) => a.type === 'booking').map((a) => a.description?.replace(/^Booking created: /, '')).pop(),
      observations: test.annotations.filter((a) => a.type === 'observation' || a.type === 'defect').map((a) => `${a.type}: ${a.description}`),
    };
    this.rows = this.rows.filter((r) => !(r.id === row.id && r.project === row.project));
    this.rows.push(row);
  }

  /**
   * Credential hygiene: Playwright's error-context page snapshots record input values (including
   * password fields) and traces record request bodies. After every run, scrub each configured
   * secret value from all text artifacts and delete traces of tests that signed in.
   */
  private scrubArtifacts(): void {
    const secrets = secretValues();
    const credentialed = this.rows.some((r) => r.tags.some((t) => ['@prime', '@prime-flights', '@prime-hotels', '@affiliate'].includes(t)));
    const textExt = /\.(md|json|txt|log|yml|yaml|xml|html?)$/i;
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (credentialed && /trace\.zip$/i.test(entry.name) && /prime|affiliate/i.test(full)) { fs.rmSync(full, { force: true }); continue; }
        if (!secrets.length || !textExt.test(entry.name) || fs.statSync(full).size > 20 * 1024 * 1024) continue;
        const text = fs.readFileSync(full, 'utf8');
        const scrubbed = secrets.reduce((acc, s) => acc.split(s).join('<redacted>'), text);
        if (scrubbed !== text) fs.writeFileSync(full, scrubbed);
      }
    };
    walk(this.outputDir);
    walk('playwright-report');
  }

  onEnd(result: FullResult): void {
    this.scrubArtifacts();
    const count = (s: Status, rows = this.rows) => rows.filter((r) => r.status === s).length;
    const modules = [...new Set(this.rows.map((r) => r.module))].sort();
    const summary = {
      startedAt: this.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      baseUrl: this.baseUrl,
      overall: result.status,
      total: this.rows.length,
      passed: count('PASS'),
      failed: count('FAIL'),
      flaky: count('FLAKY'),
      blocked: count('BLOCKED'),
      skipped: count('SKIPPED'),
      byModule: Object.fromEntries(
        modules.map((m) => {
          const rows = this.rows.filter((r) => r.module === m);
          return [m, { total: rows.length, passed: count('PASS', rows), failed: count('FAIL', rows), blocked: count('BLOCKED', rows), skipped: count('SKIPPED', rows), flaky: count('FLAKY', rows) }];
        }),
      ),
      bySuite: Object.fromEntries(
        [...new Set(this.rows.map((r) => r.suite))].sort().map((s) => {
          const rows = this.rows.filter((r) => r.suite === s);
          return [s, { total: rows.length, passed: count('PASS', rows), failed: count('FAIL', rows), blocked: count('BLOCKED', rows), skipped: count('SKIPPED', rows), flaky: count('FLAKY', rows) }];
        }),
      ),
      tests: this.rows,
    };
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'execution-summary.json'), JSON.stringify(summary, null, 2));

    const lines: string[] = [];
    lines.push(`## Wakanow Playwright execution summary`);
    lines.push('');
    lines.push(`Environment: ${this.baseUrl} · Overall: **${result.status.toUpperCase()}**`);
    lines.push('');
    lines.push('| Metric | Count |', '|---|---:|');
    lines.push(`| Total | ${summary.total} |`, `| Passed | ${summary.passed} |`, `| Failed | ${summary.failed} |`);
    lines.push(`| Flaky | ${summary.flaky} |`, `| Blocked | ${summary.blocked} |`, `| Skipped | ${summary.skipped} |`);
    lines.push('', '| Module | Total | Pass | Fail | Blocked | Skipped |', '|---|---:|---:|---:|---:|---:|');
    for (const [m, c] of Object.entries(summary.byModule)) lines.push(`| ${m} | ${c.total} | ${c.passed} | ${c.failed} | ${c.blocked} | ${c.skipped} |`);
    lines.push('', '| Suite | Total | Pass | Fail | Blocked | Skipped |', '|---|---:|---:|---:|---:|---:|');
    for (const [s, c] of Object.entries(summary.bySuite)) lines.push(`| ${s} | ${c.total} | ${c.passed} | ${c.failed} | ${c.blocked} | ${c.skipped} |`);
    const failed = this.rows.filter((r) => r.status === 'FAIL');
    if (failed.length) {
      lines.push('', '### Failed tests', '');
      for (const r of failed) lines.push(`- **${r.title}** [${r.project}] — ${(r.error ?? '').slice(0, 300)}`);
    }
    const blocked = this.rows.filter((r) => r.status === 'BLOCKED');
    if (blocked.length) {
      lines.push('', '### Blocked tests', '');
      for (const r of blocked) lines.push(`- **${r.title}** [${r.project}] — ${r.blockedReason}`);
    }
    const paid = this.rows.filter((r) => r.paymentRoute);
    if (paid.length) {
      lines.push('', '### Payment routes used', '', '| Test | Project | Status | Booking | Route |', '|---|---|---|---|---|');
      for (const r of paid) lines.push(`| ${r.title} | ${r.project} | ${r.status} | ${r.booking ?? ''} | ${r.paymentRoute} |`);
    }
    const md = lines.join('\n') + '\n';
    fs.writeFileSync(path.join(this.outputDir, 'execution-summary.md'), md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }

  printsToStdio(): boolean {
    return false;
  }
}
