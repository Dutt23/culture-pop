import {
  CreateMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type AppConfig,
  type MLCEngine,
  type ModelRecord,
} from '@mlc-ai/web-llm';
import { expose } from 'comlink';
import type { LlmWorkerApi } from '../services/llm/client';

/**
 * Runs WebLLM off the main thread, exposed with Comlink (API in `src/services/llm/client.ts`).
 * Created only after the user agrees to the download. Output goes back as raw text: the main
 * thread validates it. Errors (allocation failures, a lost GPU device) reject the call; the
 * client then terminates this worker, which frees its memory.
 */

let engine: MLCEngine | undefined;
let thinking = false;

/** Cache API storage (WebLLM's default and best-tested backend), one pinned record per load. */
function appConfig(record: ModelRecord): AppConfig {
  return { model_list: [record], cacheBackend: 'cache' };
}

const api: LlmWorkerApi = {
  async load(record, withThinking, onProgress) {
    const config = appConfig(record);
    const fromCache = await hasModelInCache(record.model_id, config);
    const start = performance.now();
    engine = await CreateMLCEngine(record.model_id, {
      appConfig: config,
      initProgressCallback: (report) =>
        void onProgress({ progress: report.progress, text: report.text }),
    });
    thinking = withThinking;
    return { ms: performance.now() - start, fromCache };
  },

  async run(job) {
    if (!engine) throw new Error('No model loaded');
    const start = performance.now();
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: job.system },
        { role: 'user', content: job.user },
      ],
      temperature: 0,
      max_tokens: job.maxTokens,
      response_format: { type: 'json_object', schema: JSON.stringify(job.schema) },
      // Qwen3-style templates think out loud unless told not to; others must not get the flag.
      ...(thinking ? { extra_body: { enable_thinking: false } } : {}),
    });
    const usage = reply.usage;
    return {
      text: reply.choices[0]?.message.content ?? '',
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      firstTokenMs: (usage?.extra.time_to_first_token_s ?? Number.NaN) * 1000,
      totalMs: performance.now() - start,
      decodeTokensPerSecond: usage?.extra.decode_tokens_per_s ?? Number.NaN,
      finishReason: reply.choices[0]?.finish_reason ?? 'unknown',
    };
  },

  async interrupt() {
    await engine?.interruptGenerate();
  },

  async remove(record) {
    await engine?.unload();
    engine = undefined;
    const config = appConfig(record);
    // WebLLM's delete fetches the model's file list from Hugging Face when it isn't cached:
    // that would be a download without consent, and there is nothing to delete anyway.
    if (await hasModelInCache(record.model_id, config)) {
      await deleteModelAllInfoInCache(record.model_id, config);
    }
  },

  async heapBytes() {
    return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
      ?.usedJSHeapSize;
  },
};

expose(api);
