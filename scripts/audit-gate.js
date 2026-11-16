#!/usr/bin/env node
// Dependency vulnerability gate: fails on any advisory nobody has reviewed.
// Reviewed exceptions live in security/audit-allowlist.json and must carry an expiry date.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
/** Dev-only advisories below this severity are reported but do not fail the gate. */
const DEV_FAIL_AT = SEVERITY_RANK.high;

/** Flattens `npm audit --json` output into unique advisories keyed by GHSA id. */
export function advisoriesFrom(audit) {
  const byId = new Map();
  for (const vulnerability of Object.values(audit.vulnerabilities ?? {})) {
    for (const via of vulnerability.via) {
      if (typeof via !== 'object') continue;
      const id = via.url.split('/').pop();
      byId.set(id, { id, package: via.name, severity: via.severity, title: via.title });
    }
  }
  return [...byId.values()];
}

/**
 * Shipped (production) advisories always fail unless allowlisted; dev-only ones fail at high+.
 * Expired allowlist entries fail too, so exceptions cannot quietly become permanent.
 */
export function evaluate({ prodAudit, fullAudit, allowlist, today }) {
  const allowed = new Map(allowlist.map((entry) => [entry.id, entry]));
  const prodIds = new Set(advisoriesFrom(prodAudit).map((a) => a.id));
  const present = advisoriesFrom(fullAudit);
  const presentIds = new Set(present.map((a) => a.id));
  const failures = [];
  const warnings = [];

  for (const entry of allowlist) {
    if (entry.expires < today) {
      failures.push(
        `allowlist entry ${entry.id} (${entry.package}) expired ${entry.expires}: upgrade or re-review`,
      );
    } else if (!presentIds.has(entry.id)) {
      warnings.push(`allowlist entry ${entry.id} (${entry.package}) no longer applies: remove it`);
    }
  }

  for (const advisory of present) {
    if (allowed.has(advisory.id)) continue;
    const isProd = prodIds.has(advisory.id);
    const label = `${advisory.severity} ${advisory.id} ${advisory.package}${isProd ? ' [shipped]' : ''}: ${advisory.title}`;
    if (isProd || SEVERITY_RANK[advisory.severity] >= DEV_FAIL_AT) failures.push(label);
    else warnings.push(label);
  }

  return { failures, warnings };
}

function runAudit(extraArgs) {
  let output;
  try {
    output = execFileSync('npm', ['audit', '--json', ...extraArgs], { encoding: 'utf8' });
  } catch (error) {
    // npm audit exits non-zero whenever it finds anything; the report is still on stdout.
    if (!error.stdout) throw error;
    output = error.stdout;
  }
  const report = JSON.parse(output);
  // A registry/network failure must fail the gate, never pass it with an empty report.
  if (report.error)
    throw new Error(`npm audit failed: ${report.error.summary ?? report.error.code}`);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const allowlistPath = new URL('../security/audit-allowlist.json', import.meta.url);
  const { advisories: allowlist } = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const { failures, warnings } = evaluate({
    prodAudit: runAudit(['--omit=dev']),
    fullAudit: runAudit([]),
    allowlist,
    today: new Date().toISOString().slice(0, 10),
  });
  for (const warning of warnings) console.warn(`warn  ${warning}`);
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  if (failures.length > 0) {
    console.error(`\nAudit gate failed: ${failures.length} unreviewed or expired advisories.`);
    process.exit(1);
  }
  console.log(`Audit gate passed (${warnings.length} warnings).`);
}
