import { describe, expect, it } from 'vitest';
import { advisoriesFrom, evaluate } from './audit-gate.js';

function advisory(id, name, severity) {
  return { name, severity, title: `${name} issue`, url: `https://github.com/advisories/${id}` };
}

function report(...advisories) {
  return {
    vulnerabilities: Object.fromEntries(
      advisories.map((a) => [a.name, { via: [a, 'some-parent-package'] }]),
    ),
  };
}

const TODAY = '2026-11-15';
const PROD_MODERATE = advisory('GHSA-prod', 'router', 'moderate');
const DEV_CRITICAL = advisory('GHSA-crit', 'test-runner', 'critical');
const DEV_MODERATE = advisory('GHSA-mod', 'glob', 'moderate');

describe('advisoriesFrom', () => {
  it('deduplicates advisories and skips parent-package references', () => {
    const audit = {
      vulnerabilities: {
        a: { via: [PROD_MODERATE, 'b'] },
        b: { via: [PROD_MODERATE] },
      },
    };
    expect(advisoriesFrom(audit)).toEqual([
      { id: 'GHSA-prod', package: 'router', severity: 'moderate', title: 'router issue' },
    ]);
  });

  it('handles a clean report', () => {
    expect(advisoriesFrom({ vulnerabilities: {} })).toEqual([]);
  });
});

describe('evaluate', () => {
  it('fails on any unreviewed advisory in shipped code, whatever its severity', () => {
    const { failures } = evaluate({
      prodAudit: report(PROD_MODERATE),
      fullAudit: report(PROD_MODERATE),
      allowlist: [],
      today: TODAY,
    });
    expect(failures).toEqual([expect.stringContaining('GHSA-prod router [shipped]')]);
  });

  it('fails on high or critical dev advisories but only warns on lower ones', () => {
    const { failures, warnings } = evaluate({
      prodAudit: report(),
      fullAudit: report(DEV_CRITICAL, DEV_MODERATE),
      allowlist: [],
      today: TODAY,
    });
    expect(failures).toEqual([expect.stringContaining('GHSA-crit')]);
    expect(warnings).toEqual([expect.stringContaining('GHSA-mod')]);
  });

  it('passes reviewed advisories that are still within their expiry', () => {
    const { failures } = evaluate({
      prodAudit: report(PROD_MODERATE),
      fullAudit: report(PROD_MODERATE, DEV_CRITICAL),
      allowlist: [
        { id: 'GHSA-prod', package: 'router', expires: '2026-12-31' },
        { id: 'GHSA-crit', package: 'test-runner', expires: TODAY },
      ],
      today: TODAY,
    });
    expect(failures).toEqual([]);
  });

  it('fails once an allowlist entry expires', () => {
    const { failures } = evaluate({
      prodAudit: report(),
      fullAudit: report(DEV_CRITICAL),
      allowlist: [{ id: 'GHSA-crit', package: 'test-runner', expires: '2026-11-14' }],
      today: TODAY,
    });
    expect(failures).toEqual([expect.stringContaining('expired 2026-11-14')]);
  });

  it('flags allowlist entries that no longer match anything', () => {
    const { failures, warnings } = evaluate({
      prodAudit: report(),
      fullAudit: report(),
      allowlist: [{ id: 'GHSA-gone', package: 'old', expires: '2027-01-01' }],
      today: TODAY,
    });
    expect(failures).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('no longer applies')]);
  });
});
