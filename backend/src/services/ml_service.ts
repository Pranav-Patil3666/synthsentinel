import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";

export interface MLRequestContext {
  sessionId?: string;
  callId?: string;
  chunkIndex?: number;
}

export interface MLFinalDecision {
  label: string;
  confidence: number;
  real_prob: number;
  fake_prob: number;
  risk: string;
  threshold: number;
  skipped: boolean;
}

export interface MLInferenceResponse {
  skip?: boolean;
  skipped?: boolean;
  skip_reason?: string;

  session_id?: string;
  call_id?: string;
  chunk_index?: number;

  final?: MLFinalDecision;

  audio_rule?: any;
  cnn?: any;
  wav2vec2?: any;
  rules?: any;
  ensemble?: any;
  session_summary?: any;
  thresholds?: any;
  ensemble_weights?: any;
  request?: any;
  raw?: any;
}

export const sendToML = async (
  filePath: string,
  ctx: MLRequestContext = {}
): Promise<MLInferenceResponse | null> => {
  try {
    const form = new FormData();

    form.append("file", fs.createReadStream(filePath), path.basename(filePath));

    if (ctx.sessionId) {
      form.append("session_id", ctx.sessionId);
    }

    if (ctx.callId) {
      form.append("call_id", ctx.callId);
    }

    if (typeof ctx.chunkIndex === "number") {
      form.append("chunk_index", String(ctx.chunkIndex));
    }

    const response = await axios.post("http://127.0.0.1:8000/infer", form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    const data: MLInferenceResponse = response.data;
    console.log("ML RAW RESPONSE:", data);

    if (response.status >= 400) {
      console.error("❌ ML service returned error:", data);
      return null;
    }

    if (data.skip || data.skipped || data.final?.skipped) {
      return {
        skip: true,
        skipped: true,
        skip_reason: data.skip_reason ?? data.final?.skipped ? "skipped" : undefined,
        session_id: data.session_id,
        call_id: data.call_id,
        chunk_index: data.chunk_index,
        request: data.request,
        raw: data,
      };
    }

    const final = data.final ?? {
      label: "UNKNOWN",
      confidence: 0,
      real_prob: 0,
      fake_prob: 0,
      risk: "UNKNOWN",
      threshold: 0.5,
      skipped: false,
    };

    return {
      skip: false,
      skipped: false,
      skip_reason: data.skip_reason,
      session_id: data.session_id ?? data.request?.session_id,
      call_id: data.call_id ?? data.request?.call_id,
      chunk_index: data.chunk_index ?? data.request?.chunk_index,

      final,
      label: final.label,
      confidence: final.confidence,
      real_prob: final.real_prob,
      fake_prob: final.fake_prob,
      risk: final.risk,
      threshold: final.threshold,

      audio_rule: data.audio_rule,
      cnn: data.cnn,
      wav2vec2: data.wav2vec2,
      rules: data.rules,
      ensemble: data.ensemble,
      session_summary: data.session_summary,
      thresholds: data.thresholds,
      ensemble_weights: data.ensemble_weights,
      request: data.request,
      raw: data,
    } as MLInferenceResponse;
  } catch (error: any) {
    console.error("❌ ML service error:", error.message);
    return null;
  }
};