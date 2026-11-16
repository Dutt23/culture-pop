import { useEffect, useMemo, useRef, useState } from 'react';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import {
  createLlmClient,
  detectSupport,
  errorMessage,
  pickVariant,
  type Support,
} from '../../services/llm/client';
import { formatMegabytes, MODEL_FAMILIES } from '../../services/llm/models';
import { browserHttpDependencies, createGetJson } from '../../services/retrieval/http';
import styles from './DevComponentsPage.module.css';
import {
  deviceInfo,
  jsHeapBytes,
  modelSummary,
  runBench,
  startMemorySampler,
  storageUsage,
  type BenchJobs,
  type BenchResults,
  type ModelInfo,
} from './llmBench';
import { renderBenchReport } from './llmBenchReport';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Development-only: runs the on-device model benchmark (docs/research/ondevice-llm.md). */
export default function LlmBenchPage() {
  const client = useMemo(() => createLlmClient(), []);
  const getJson = useMemo(() => createGetJson(browserHttpDependencies), []);
  const [support, setSupport] = useState<Support>();
  const [familyKey, setFamilyKey] = useState(MODEL_FAMILIES[0]?.key ?? '');
  const [progress, setProgress] = useState('');
  const [model, setModel] = useState<ModelInfo>();
  const [jobs, setJobs] = useState<BenchJobs>({
    explain: true,
    stories: true,
    spoilers: true,
    rewrites: true,
  });
  const [explainLimit, setExplainLimit] = useState(30);
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<BenchResults>();
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = running || loading;
  const stop = useRef<AbortController>(undefined);

  useEffect(() => {
    detectSupport().then(setSupport);
    // Leaving the page stops the run (no more model calls or Wikimedia lookups) and frees the model.
    return () => {
      stop.current?.abort();
      client.dispose();
    };
  }, [client]);

  const family = MODEL_FAMILIES.find((f) => f.key === familyKey);
  const variant = family && support?.ok ? pickVariant(family, support) : undefined;
  const addLog = (line: string) => setLog((lines) => [...lines.slice(-200), line]);

  async function load() {
    if (!family || !variant) return;
    setModel(undefined);
    setLoading(true);
    const before = await storageUsage();
    const stopMemory = startMemorySampler(client);
    // The button text stated this exact size and memory: that click is the consent.
    client
      .load(family, variant, { modelId: variant.modelId, bytes: variant.downloadBytes })
      .subscribe({
        next: async (event) => {
          if (event.type === 'progress') {
            setProgress(`${Math.round(event.progress * 100)}% ${event.text}`);
            return;
          }
          const peaks = stopMemory();
          setLoading(false);
          setProgress('Loaded');
          setModel({
            ...modelSummary(family, variant),
            fromCache: event.fromCache,
            loadMs: event.ms,
            storageBeforeBytes: before,
            storageAfterBytes: await storageUsage(),
            loadPeakMainBytes: peaks.mainPeakBytes,
            loadPeakWorkerBytes: peaks.workerPeakBytes,
          });
        },
        // The worker is already terminated (memory freed); no automatic retry.
        error: (error: unknown) => {
          stopMemory();
          setLoading(false);
          setProgress(`Could not load the model: ${errorMessage(error)}`);
        },
      });
  }

  async function run() {
    if (!model || !support) return;
    const controller = new AbortController();
    stop.current = controller;
    setRunning(true);
    setResults(undefined);
    setLog([]);
    const startedAt = new Date().toISOString();
    try {
      const measured = await runBench(
        {
          client,
          getJson,
          now: () => new Date().toISOString(),
          sleep,
          log: addLog,
          signal: controller.signal,
        },
        jobs,
        explainLimit,
      );
      setResults({ startedAt, device: deviceInfo(support), model, ...measured });
    } catch (error) {
      addLog(`Run failed: ${errorMessage(error)}`);
    } finally {
      setRunning(false);
    }
  }

  function unload() {
    client.dispose();
    setModel(undefined);
    const heap = jsHeapBytes();
    setProgress(
      `Unloaded (worker terminated)${heap === undefined ? '' : `; main-thread heap ${formatMegabytes(heap)}`}`,
    );
  }

  async function remove() {
    if (!variant) return;
    setModel(undefined);
    try {
      await client.remove(variant);
      setProgress(`Deleted ${variant.modelId}`);
    } catch (error) {
      setProgress(`Could not delete: ${errorMessage(error)}`);
    }
  }

  const report = results ? renderBenchReport(results) : '';
  const json = useMemo(
    () =>
      results
        ? URL.createObjectURL(
            new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' }),
          )
        : undefined,
    [results],
  );
  useEffect(
    () => () => {
      if (json) URL.revokeObjectURL(json);
    },
    [json],
  );

  return (
    <Page title="On-device model benchmark" eyebrow="Development only">
      <Section title="Device">
        <p>
          {support === undefined
            ? 'Checking WebGPU…'
            : support.ok
              ? `WebGPU available (${support.adapter || 'adapter'}; shader-f16 ${support.shaderF16 ? 'yes' : 'no'}).`
              : `No model on this device (${support.reason}). The app keeps working with the deterministic curator only.`}
        </p>
      </Section>
      {support?.ok && family && (
        <Section
          title="Model"
          description={`Memory budget on this device: ${support.memoryBudgetMB} MB of graphics memory. Each download stays in this browser's cache until you delete it.`}
        >
          <div className={styles.stack}>
            <label>
              Model{' '}
              <select
                value={familyKey}
                onChange={(e) => setFamilyKey(e.target.value)}
                disabled={busy}
              >
                {MODEL_FAMILIES.map((f) => {
                  const fit = pickVariant(f, support);
                  return (
                    <option key={f.key} value={f.key}>
                      {f.label} (
                      {fit
                        ? `${formatMegabytes(fit.downloadBytes)}, ~${fit.vramMB} MB memory`
                        : 'over this device’s memory budget'}
                      , {f.licence})
                    </option>
                  );
                })}
              </select>
            </label>
            {variant ? (
              <div className={styles.row}>
                <button type="button" className={styles.button} onClick={load} disabled={busy}>
                  Download {formatMegabytes(variant.downloadBytes)} from Hugging Face and load (uses
                  about {variant.vramMB} MB of memory)
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={unload}
                  disabled={running || !model}
                >
                  Unload (free memory)
                </button>
                <button type="button" className={styles.button} onClick={remove} disabled={busy}>
                  Delete downloaded files
                </button>
              </div>
            ) : (
              <p>
                This model needs more memory than this device's budget, so it can't be loaded here.
              </p>
            )}
            <p role="status">{progress}</p>
          </div>
        </Section>
      )}
      {model && (
        <Section title="Run">
          <div className={styles.stack}>
            <div className={styles.row}>
              {(Object.keys(jobs) as (keyof BenchJobs)[]).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={jobs[key]}
                    onChange={(e) => setJobs({ ...jobs, [key]: e.target.checked })}
                    disabled={running}
                  />{' '}
                  {key}
                </label>
              ))}
              <label>
                Explanation cases{' '}
                <input
                  type="number"
                  min={1}
                  max={94}
                  value={explainLimit}
                  onChange={(e) => setExplainLimit(Number(e.target.value) || 1)}
                  disabled={running}
                />
              </label>
            </div>
            <div className={styles.row}>
              <button type="button" className={styles.button} onClick={run} disabled={running}>
                Run benchmark
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => stop.current?.abort()}
                disabled={!running}
              >
                Stop after this case
              </button>
            </div>
            <pre className={styles.clip}>{log.join('\n')}</pre>
          </div>
        </Section>
      )}
      {results && json && (
        <Section title="Report" description="Copy the Markdown, or save the JSON for docs/eval/.">
          <div className={styles.stack}>
            <a
              className={styles.button}
              href={json}
              download={`llm-bench-${results.model.modelId}-${results.startedAt.slice(0, 10)}.json`}
            >
              Save JSON
            </a>
            <textarea readOnly rows={20} value={report} aria-label="Benchmark report" />
          </div>
        </Section>
      )}
    </Page>
  );
}
