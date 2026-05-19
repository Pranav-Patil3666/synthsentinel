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

export const initWebSocket = (server: any) => {
  const wss = new WebSocketServer({ server });

  wss.setMaxListeners(20);

  wss.on("connection", (ws: WebSocket) => {
    console.log("🔌 Client connected");

    const sessionId = randomUUID();
    const riskEngine = new RiskEngine();
    let localChunkIndex = 0;
    let callId: string | undefined = undefined;

    ws.send(
      JSON.stringify({
        type: "session",
        sessionId,
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
              message: "Missing filePath",
              sessionId,
            })
          );
          return;
        }

        callId = data.callId ?? callId ?? sessionId;
        const chunkIndex =
          typeof data.chunkIndex === "number"
            ? data.chunkIndex
            : localChunkIndex++;

        const result = await sendToML(filePath, {
          sessionId,
          callId,
          chunkIndex,
        });

        if (!result || result.skip) {
          safeUnlink(filePath);

          ws.send(
            JSON.stringify({
              type: "skip",
              sessionId,
              callId,
              chunkIndex,
              skip: true,
              skip_reason: result?.skip_reason ?? "non_speech_or_unusable_chunk",
            })
          );
          return;
        }

        const fakeProb = result.fake_prob ?? result.final?.fake_prob ?? 0;

        // Temporary backend-side rolling view for the dashboard.
        // The authoritative decision still comes from the inference service.
        const rollingRisk = riskEngine.addPrediction(fakeProb);

        const finalLabel = result.final?.label ?? result.label ?? "UNKNOWN";
        const finalConfidence = result.final?.confidence ?? result.confidence ?? 0;
        const finalRisk = result.final?.risk ?? result.risk ?? rollingRisk;
        const finalRealProb = result.final?.real_prob ?? result.real_prob ?? 0;
        const finalFakeProb = result.final?.fake_prob ?? result.fake_prob ?? 0;

        ws.send(
          JSON.stringify({
            type: "prediction",
            sessionId,
            callId,
            chunkIndex,
            label: finalLabel,
            confidence: finalConfidence,
            risk: finalRisk,
            real_prob: finalRealProb,
            fake_prob: finalFakeProb,
            threshold: result.final?.threshold ?? result.threshold ?? 0.5,
            stats: riskEngine.getStats(),
            session_summary: result.session_summary,
            cnn: result.cnn,
            wav2vec2: result.wav2vec2,
            rules: result.rules,
            ensemble: result.ensemble,
            final: result.final,
            raw: result.raw,
          })
        );

        safeUnlink(filePath);
      } catch (err) {
        console.error("❌ WS error:", err);
        ws.send(
          JSON.stringify({
            type: "error",
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