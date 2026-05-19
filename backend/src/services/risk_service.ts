export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface RiskUpdateInput {
  callId?: string;
  label?: string;
  inferenceRisk?: string;
  chunkIndex?: number;
  skipped?: boolean;
}

export interface SessionRiskStats {
  sessionId: string;
  callId: string;
  history: number[];
  smoothed: number | null;
  backendRisk: RiskBand;
  combinedRisk: RiskBand;
  previousRisk: RiskBand;
  fakeStreak: number;
  mediumStreak: number;
  highStreak: number;
  totalChunks: number;
  skippedChunks: number;
  lastFakeProb: number;
  lastLabel: string;
  rollingAvg: number;
  trend: number;
  updatedAt: string;
}

const RISK_ORDER: Record<RiskBand, number> = {
  UNKNOWN: -1,
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeRisk(value?: string): RiskBand {
  const v = (value ?? "UNKNOWN").toUpperCase();
  if (v === "LOW" || v === "MEDIUM" || v === "HIGH" || v === "UNKNOWN") {
    return v;
  }
  return "UNKNOWN";
}

function maxRisk(a: RiskBand, b: RiskBand): RiskBand {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface SessionState {
  sessionId: string;
  callId: string;
  history: number[];
  smoothed: number | null;
  backendRisk: RiskBand;
  combinedRisk: RiskBand;
  previousRisk: RiskBand;
  fakeStreak: number;
  mediumStreak: number;
  highStreak: number;
  totalChunks: number;
  skippedChunks: number;
  lastFakeProb: number;
  lastLabel: string;
  updatedAt: string;
}

export class RiskEngine {
  private sessions = new Map<string, SessionState>();

  private readonly maxWindow = 5;
  private readonly alpha = 0.6;

  private readonly mediumThreshold = 0.55;
  private readonly highThreshold = 0.75;
  private readonly spikeDelta = 0.45;

  private getOrCreateSession(sessionId: string, callId?: string): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      if (callId && !existing.callId) {
        existing.callId = callId;
      }
      return existing;
    }

    const fresh: SessionState = {
      sessionId,
      callId: callId ?? "",
      history: [],
      smoothed: null,
      backendRisk: "UNKNOWN",
      combinedRisk: "UNKNOWN",
      previousRisk: "UNKNOWN",
      fakeStreak: 0,
      mediumStreak: 0,
      highStreak: 0,
      totalChunks: 0,
      skippedChunks: 0,
      lastFakeProb: 0,
      lastLabel: "UNKNOWN",
      updatedAt: nowIso(),
    };

    this.sessions.set(sessionId, fresh);
    return fresh;
  }

  private computeBackendRisk(history: number[], smoothed: number | null): RiskBand {
    if (history.length === 0) {
      return "LOW";
    }

    const highHits = history.filter((v) => v >= this.highThreshold).length;
    const mediumHits = history.filter((v) => v >= this.mediumThreshold).length;

    let risk: RiskBand = "LOW";

    if (highHits >= 3) {
      risk = "HIGH";
    } else if (mediumHits >= 2 || (smoothed ?? 0) >= this.mediumThreshold) {
      risk = "MEDIUM";
    }

    if (history.length >= 2) {
      const last = history[history.length - 1];
      const prev = history[history.length - 2];
      const spike = Math.abs(last - prev);

      if (spike >= this.spikeDelta && risk === "LOW") {
        risk = "MEDIUM";
      }
    }

    if (history.length >= 2) {
      const trend = history[history.length - 1] - history[0];
      if (trend >= 0.25 && risk === "LOW") {
        risk = "MEDIUM";
      }
    }

    return risk;
  }

  update(
    sessionId: string,
    fakeProb: number,
    input: RiskUpdateInput = {}
  ): { risk: RiskBand; backendRisk: RiskBand; stats: SessionRiskStats; reason: string } {
    const state = this.getOrCreateSession(sessionId, input.callId);

    const p = clamp01(fakeProb);

    state.totalChunks += 1;
    state.lastFakeProb = p;
    state.lastLabel = input.label?.trim() || state.lastLabel;

    state.history.push(p);
    if (state.history.length > this.maxWindow) {
      state.history.shift();
    }

    if (state.smoothed === null) {
      state.smoothed = p;
    } else {
      state.smoothed = this.alpha * p + (1 - this.alpha) * state.smoothed;
    }

    const backendRisk = this.computeBackendRisk(state.history, state.smoothed);

    let combinedRisk = backendRisk;
    const inferenceRisk = normalizeRisk(input.inferenceRisk);

    combinedRisk = maxRisk(combinedRisk, inferenceRisk);

    if (p >= this.highThreshold) {
      state.fakeStreak += 1;
      state.mediumStreak = 0;
    } else if (p >= this.mediumThreshold) {
      state.mediumStreak += 1;
      state.fakeStreak = 0;
    } else {
      state.fakeStreak = 0;
      state.mediumStreak = 0;
    }

    if (combinedRisk === "HIGH") {
      state.highStreak += 1;
    } else if (combinedRisk === "MEDIUM") {
      state.highStreak = 0;
    } else {
      state.highStreak = 0;
    }

    state.backendRisk = backendRisk;
    state.combinedRisk = combinedRisk;
    state.previousRisk = combinedRisk;
    state.updatedAt = nowIso();

    const rollingAvg =
      state.history.length > 0
        ? state.history.reduce((a, b) => a + b, 0) / state.history.length
        : 0;

    const trend =
      state.history.length >= 2
        ? state.history[state.history.length - 1] - state.history[0]
        : 0;

    const stats = this.getStats(sessionId);

    let reason = "probability_trend";
    if (inferenceRisk !== "UNKNOWN") {
      reason = `backend:${backendRisk}, inference:${inferenceRisk}`;
    } else {
      reason = `backend:${backendRisk}`;
    }

    if (combinedRisk === "HIGH" && state.fakeStreak >= 3) {
      reason = `${reason}, fake_streak`;
    }

    return {
      risk: combinedRisk,
      backendRisk,
      stats: {
        ...stats,
        rollingAvg,
        trend,
      },
      reason,
    };
  }

  getStats(sessionId: string): SessionRiskStats {
    const state = this.getOrCreateSession(sessionId);

    const rollingAvg =
      state.history.length > 0
        ? state.history.reduce((a, b) => a + b, 0) / state.history.length
        : 0;

    const trend =
      state.history.length >= 2
        ? state.history[state.history.length - 1] - state.history[0]
        : 0;

    return {
      sessionId: state.sessionId,
      callId: state.callId,
      history: [...state.history],
      smoothed: state.smoothed,
      backendRisk: state.backendRisk,
      combinedRisk: state.combinedRisk,
      previousRisk: state.previousRisk,
      fakeStreak: state.fakeStreak,
      mediumStreak: state.mediumStreak,
      highStreak: state.highStreak,
      totalChunks: state.totalChunks,
      skippedChunks: state.skippedChunks,
      lastFakeProb: state.lastFakeProb,
      lastLabel: state.lastLabel,
      rollingAvg,
      trend,
      updatedAt: state.updatedAt,
    };
  }

  registerSkip(sessionId: string, callId?: string): SessionRiskStats {
    const state = this.getOrCreateSession(sessionId, callId);
    state.skippedChunks += 1;
    state.updatedAt = nowIso();
    return this.getStats(sessionId);
  }

  resetSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}