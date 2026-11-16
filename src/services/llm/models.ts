import type { ModelRecord } from '@mlc-ai/web-llm';

/**
 * On-device model candidates for the Phase 3 benchmark (docs/research/ondevice-llm.md).
 *
 * Every URL is pinned to a commit, so an upstream re-upload can't change what runs. The files
 * that are code or steer the code (model library WASM, chat config, tokenizer) carry SRI hashes
 * that WebLLM checks before use; weights have no hash in WebLLM, so they rely on the pinned
 * commit. Hashes, sizes and commits were read on 2026-11-16; the "Model pins" section of the
 * research doc says how to refresh them.
 */

/** binary-mlc-llm-libs commit holding the v0_2_87 model libraries that @mlc-ai/web-llm 0.2.88 uses. */
const LIBS_COMMIT = '146ed9cd4b4062e967b017fd2291f7106b50599f';
const LIBS = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${LIBS_COMMIT}/web-llm-models/v0_2_87/base`;

/**
 * Hard cap on prompt + answer tokens, so the KV cache (and GPU memory) stays small: the system
 * prompt (~150 tokens), evidence capped at `MAX_EVIDENCE_CHARS` (~1,300 tokens with its JSON or
 * TOON framing) and at most 700 answer tokens fit. WebLLM's own estimates assume 4096.
 */
export const CONTEXT_WINDOW = 3072;

export interface ModelVariant {
  modelId: string;
  /** Total download: every file in the pinned repo plus the model library. */
  downloadBytes: number;
  /** WebLLM's own estimate of GPU memory needed. */
  vramMB: number;
  /** q4f16 needs the WebGPU `shader-f16` feature; q4f32 runs without it. */
  needsShaderF16: boolean;
  record: ModelRecord;
}

export interface ModelFamily {
  key: string;
  label: string;
  licence: string;
  /** Qwen3-style template: thinking must be switched off per request. */
  thinking: boolean;
  f16: ModelVariant;
  f32: ModelVariant;
}

interface Pin {
  modelId: string;
  repoCommit: string;
  repoBytes: number;
  lib: string;
  libBytes: number;
  libSri: string;
  configSri: string;
  tokenizerSri: string;
  vramMB: number;
  /** Extra chat settings WebLLM's own record for this model sets (copied from its prebuilt list). */
  overrides?: ModelRecord['overrides'];
}

function variant(pin: Pin): ModelVariant {
  return {
    modelId: pin.modelId,
    downloadBytes: pin.repoBytes + pin.libBytes,
    vramMB: pin.vramMB,
    needsShaderF16: pin.modelId.includes('q4f16'),
    record: {
      model: `https://huggingface.co/mlc-ai/${pin.modelId}/resolve/${pin.repoCommit}/`,
      model_id: pin.modelId,
      model_lib: `${LIBS}/${pin.lib}`,
      vram_required_MB: pin.vramMB,
      low_resource_required: true,
      required_features: pin.modelId.includes('q4f16') ? ['shader-f16'] : undefined,
      overrides: { ...pin.overrides, context_window_size: CONTEXT_WINDOW },
      integrity: {
        model_lib: pin.libSri,
        config: pin.configSri,
        tokenizer: { 'tokenizer.json': pin.tokenizerSri },
        onFailure: 'error',
      },
    },
  };
}

const QWEN3_TOKENIZER = 'sha384-bBcp1iraOY8O3lJXFKDjSlRbqFZ2wbSX1HMscuq4lbj4bO+YyBt2tRf6Kj8+hxFw';
const QWEN35_TOKENIZER = 'sha384-igR9/MiPCdHa2wRfMgG669isKHEYkl0+nUjYuN+aewjckDzMClaZIO90RSMVdUpy';
/** WebLLM 0.2.88's Qwen3.5 records: one-turn history and the model's own stop tokens. */
const QWEN35_OVERRIDES: ModelRecord['overrides'] = {
  max_history_size: 1,
  conv_config: { stop_token_ids: [248046, 248044] },
};
const QWEN25_TOKENIZER = 'sha384-l5K5CpBtbywB5lTHysuesWqCadOP0PqIM5CaLYNPn2xpBA30Q5pAgRo4L1K2EjDM';

/** Apache-2.0 models only (base model cards checked 2026-11-16); smallest first. */
export const MODEL_FAMILIES: readonly ModelFamily[] = [
  {
    key: 'qwen3-0.6b',
    label: 'Qwen3 0.6B',
    licence: 'Apache-2.0',
    thinking: true,
    f16: variant({
      modelId: 'Qwen3-0.6B-q4f16_1-MLC',
      repoCommit: '8c14ce481d4c692769976ad52afea453a102df19',
      repoBytes: 351_517_143,
      lib: 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm',
      libBytes: 6_561_594,
      libSri: 'sha384-SeeQhQSxQeeOLfUYKt6goeqRBtSl26L5TVxpSpaeXRoDelrSE+U3xz6TyZ1a80zL',
      configSri: 'sha384-9fxUxKNOFFPlaUNBJNRKF5bctTgaxIbd2eszFnw4jzDyqL0O7tuJxJYFqeBz54z4',
      tokenizerSri: QWEN3_TOKENIZER,
      vramMB: 1403,
    }),
    f32: variant({
      modelId: 'Qwen3-0.6B-q4f32_1-MLC',
      repoCommit: '9b4f0b05b08c692ea86fe151ea878406ad22f428',
      repoBytes: 351_644_955,
      lib: 'Qwen3-0.6B-q4f32_1_cs1k-webgpu.wasm',
      libBytes: 6_440_711,
      libSri: 'sha384-+bE3gnUvM5uGWFyWP9Camg5FE6K0+bJuAYLU0I+lAAUrerkSJ0MKGnXoqSc46VMH',
      configSri: 'sha384-/oglHzVutAjcgN87eslrQsXtrddUvXg0ERXXRGmis6hC2JyhlpJKq/+wneqtKurG',
      tokenizerSri: QWEN3_TOKENIZER,
      vramMB: 1925,
    }),
  },
  {
    key: 'qwen3.5-0.8b',
    label: 'Qwen3.5 0.8B',
    licence: 'Apache-2.0',
    thinking: true,
    f16: variant({
      modelId: 'Qwen3.5-0.8B-q4f16_1-MLC',
      repoCommit: '0ec138972555613c1d7812a821778ad0398c8790',
      repoBytes: 447_177_073,
      lib: 'Qwen3.5-0.8B-q4f16_1_cs1k-webgpu.wasm',
      libBytes: 7_358_915,
      libSri: 'sha384-Av2oV4gHPTeAXbNJIs/IXPX+UnU7NAI5ReruvIkQeS3d4+KgsO2qfSgIgrPlfvnR',
      configSri: 'sha384-BbVZxST/w6sP2TDSHXwl1LP4cIzPVl4uC1mXov5TETj1Phga54VFSv1n5S0f1nKn',
      tokenizerSri: QWEN35_TOKENIZER,
      vramMB: 1629,
      overrides: QWEN35_OVERRIDES,
    }),
    f32: variant({
      modelId: 'Qwen3.5-0.8B-q4f32_1-MLC',
      repoCommit: '4ed017713f04c91ffe55a9dca8c7ac853c41314d',
      repoBytes: 447_175_335,
      lib: 'Qwen3.5-0.8B-q4f32_1_cs1k-webgpu.wasm',
      libBytes: 7_242_026,
      libSri: 'sha384-9RDRBqK3uwN9i78tgzQz0tmH/XfYISTUATFxokou3BKehgj6qpHoS0fc4+MZrNJ8',
      configSri: 'sha384-yeso0o3gYuyuXTv61d+pXUXnLusR4ohz1iCKJr+Jno1E1uk/NoJO4YB2FdlF8B7D',
      tokenizerSri: QWEN35_TOKENIZER,
      vramMB: 1894,
      overrides: QWEN35_OVERRIDES,
    }),
  },
  {
    key: 'qwen2.5-1.5b',
    label: 'Qwen2.5 1.5B Instruct',
    licence: 'Apache-2.0',
    thinking: false,
    f16: variant({
      modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
      repoCommit: '9bd564b064631febf14deadcac492efb761d60c3',
      repoBytes: 880_289_238,
      lib: 'Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
      libBytes: 6_225_379,
      libSri: 'sha384-LqpglGl7vUInmGS4OYNXTQAiqb9UGU2NrHr7CCy4vFqFiVPdk12p8FABkPSDvwRr',
      configSri: 'sha384-edTpAfxnd5O5jvlUbExraVs/Bmqwpni3s8wpFZMcNPSG+5O9sr1ltJJG9zQaM/Vb',
      tokenizerSri: QWEN25_TOKENIZER,
      vramMB: 1630,
    }),
    f32: variant({
      modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
      repoCommit: 'a822ee410075710c9673005eafa017b90136b85d',
      repoBytes: 880_412_341,
      lib: 'Qwen2-1.5B-Instruct-q4f32_1_cs1k-webgpu.wasm',
      libBytes: 6_103_791,
      libSri: 'sha384-whU7/Bx5xEJ47pa1lMHbrCuwAxv7ep2zRqezLY5gKxeITrOM/Zx7hA1sFLK140sy',
      configSri: 'sha384-s7l0iGYBJ5APr2LPnSwXd3hasAK5nEGN1sn/CuuY34cGyQ6tFkvGxzWmv1x4G3ay',
      tokenizerSri: QWEN25_TOKENIZER,
      vramMB: 1889,
    }),
  },
];

/** "352 MB", as the consent prompt states it (decimal megabytes, like phone storage settings). */
export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}
