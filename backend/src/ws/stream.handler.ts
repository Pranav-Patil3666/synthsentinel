import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import fs from "fs";
import { sendToML } from "../services/ml_service.js";
import { RiskEngine } from "../services/risk_service.js";

function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("⚠️ Failed to delete chunk:", err);
  }
}

function normalizeChunkIndex(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

export const initWebSocket = (server: any) => {
  const wss = new WebSocketServer({
  noServer: true,
  });

  server.on("upgrade", (request: any, socket: any, head: any) => {
    const url = new URL(
      request.url ?? "",
      `http://${request.headers.host ?? "localhost"}`
    );

    if (url.pathname !== "/api/stream") {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.setMaxListeners(20);

  wss.on("connection", (ws: WebSocket) => {
    console.log("🔌 Client connected");

    const sessionId = randomUUID();
    const riskEngine = new RiskEngine();
    let localChunkIndex = 0;
    let callId = sessionId;

    ws.send(
      JSON.stringify({
        type: "session",
        sessionId,
        callId,
      })
    );

    ws.on("message", async (message: any) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type !== "chunk") {
          return;
        }

        const filePath = data.filePath as string;
        if (!filePath) {
          ws.send(
            JSON.stringify({
              type: "error",
              sessionId,
              message: "Missing filePath",
            })
          );
          return;
        }

        callId =
          typeof data.callId === "string" && data.callId.trim().length > 0
            ? data.callId.trim()
            : callId;

        const chunkIndex = normalizeChunkIndex(data.chunkIndex, localChunkIndex);
        localChunkIndex = chunkIndex + 1;

        const result = await sendToML(filePath, {
          sessionId,
          callId,
          chunkIndex,
        });

        if (!result || result.skip || result.skipped || result.final?.skipped) {
          const stats = riskEngine.registerSkip(sessionId, callId);

          safeUnlink(filePath);

          ws.send(
            JSON.stringify({
              type: "skip",
              sessionId,
              callId,
              chunkIndex,
              skip: true,
              skip_reason:
                result?.skip_reason ??
                result?.raw?.skip_reason ??
                "non_speech_or_unusable_chunk",
              stats,
              session_summary: result?.session_summary ?? null,
            })
          );

          return;
        }

        const final = result.final ?? {
          label: "UNKNOWN",
          confidence: 0,
          real_prob: 0,
          fake_prob: 0,
          risk: "UNKNOWN",
          threshold: 0.5,
          skipped: false,
        };

        const backendRisk = riskEngine.update(sessionId, final.fake_prob, {
          callId,
          chunkIndex,
          label: final.label,
          inferenceRisk: final.risk,
        });

        const sessionStats = backendRisk.stats;

        ws.send(
          JSON.stringify({
            type: "prediction",
            sessionId,
            callId,
            chunkIndex,

            // canonical fused decision
            label: final.label,
            confidence: final.confidence,
            real_prob: final.real_prob,
            fake_prob: final.fake_prob,

            // authoritative model/fusion threshold
            threshold: final.threshold,

            // inference-side risk + backend trend risk
            risk: backendRisk.risk,
            backend_risk: backendRisk.backendRisk,

            // legacy compatibility / UI support
            stats: sessionStats,
            session_summary: result.session_summary ?? null,

            // rich breakdown
            audio_rule: result.audio_rule ?? null,
            cnn: result.cnn ?? null,
            wav2vec2: result.wav2vec2 ?? null,
            rules: result.rules ?? null,
            ensemble: result.ensemble ?? null,

            thresholds: result.thresholds ?? null,
            ensemble_weights: result.ensemble_weights ?? null,
            request: result.request ?? null,
            raw: result.raw ?? result,
          })
        );

        safeUnlink(filePath);
      } catch (err) {
        console.error("❌ WS error:", err);

        ws.send(
          JSON.stringify({
            type: "error",
            sessionId,
            message: "WebSocket processing failed",
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("❌ Client disconnected", sessionId);
    });
  });

  console.log("🔥 WebSocket server ready");
};