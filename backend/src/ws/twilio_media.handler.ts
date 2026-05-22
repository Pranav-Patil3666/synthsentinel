import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { sendToML } from "../services/ml_service.js";

type TwilioEventName = "connected" | "start" | "media" | "stop" | "mark" | "dtmf";

interface TwilioConnectedMessage {
  event: "connected";
  protocol: string;
  version: string;
}

interface TwilioStartMessage {
  event: "start";
  sequenceNumber?: string;
  start: {
    streamSid: string;
    accountSid?: string;
    callSid?: string;
    tracks?: string[];
    customParameters?: Record<string, string>;
    mediaFormat?: {
      encoding?: string;
      sampleRate?: number;
      channels?: number;
    };
  };
}

interface TwilioMediaMessage {
  event: "media";
  sequenceNumber?: string;
  streamSid: string;
  media: {
    track?: string;
    chunk?: string;
    timestamp?: string;
    payload: string; // base64 mu-law audio
  };
}

interface TwilioStopMessage {
  event: "stop";
  sequenceNumber?: string;
  stop?: {
    accountSid?: string;
    callSid?: string;
  };
  streamSid?: string;
}

interface TwilioStreamState {
  sessionId: string;
  callId: string;
  streamSid: string;
  accountSid?: string;
  track: string;
  chunkIndex: number;
  pcmBuffer: Buffer;
  tempDir: string;
  startedAt: string;
  processing: Promise<void>;
  stopped: boolean;
}

const INPUT_SAMPLE_RATE = 8000; // inbound audio format
const INPUT_CHANNELS = 1;
const INPUT_BYTES_PER_SAMPLE = 2; // PCM16
const CHUNK_SECONDS = 2; 
const CHUNK_SAMPLES = INPUT_SAMPLE_RATE * CHUNK_SECONDS;
const CHUNK_BYTES = CHUNK_SAMPLES * INPUT_BYTES_PER_SAMPLE;
const MIN_FINAL_CHUNK_BYTES = Math.floor(INPUT_SAMPLE_RATE * 0.5) * INPUT_BYTES_PER_SAMPLE;

function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("⚠️ Failed to delete temp chunk:", err);
  }
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function clamp16(value: number): number {
  return Math.max(-32768, Math.min(32767, value | 0));
}

// Standard G.711 μ-law decode
function muLawByteToPcmSample(uVal: number): number {
  uVal = ~uVal & 0xff;
  const sign = uVal & 0x80;
  const exponent = (uVal >> 4) & 0x07;
  const mantissa = uVal & 0x0f;

  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample = sign ? (0x84 - sample) : (sample - 0x84);

  return clamp16(sample);
}

function decodeMuLawBase64ToPcm16(payload: string): Buffer {
  const muLaw = Buffer.from(payload, "base64");
  const pcm = Buffer.allocUnsafe(muLaw.length * 2);

  for (let i = 0; i < muLaw.length; i++) {
    const sample = muLawByteToPcmSample(muLaw[i]);
    pcm.writeInt16LE(sample, i * 2);
  }

  return pcm;
}

function createWavHeader(dataLength: number, sampleRate: number, channels: number): Buffer {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function createWavBuffer(pcmData: Buffer, sampleRate = INPUT_SAMPLE_RATE, channels = INPUT_CHANNELS): Buffer {
  const header = createWavHeader(pcmData.length, sampleRate, channels);
  return Buffer.concat([header, pcmData]);
}

function getTwilioTempRoot(): string {
  return path.join(os.tmpdir(), "synthsentinel", "twilio");
}

function createSessionTempDir(sessionId: string): string {
  const dir = path.join(getTwilioTempRoot(), sessionId);
  ensureDir(dir);
  return dir;
}

function buildChunkPath(session: TwilioStreamState): string {
  return path.join(
    session.tempDir,
    `chunk_${String(session.chunkIndex).padStart(5, "0")}.wav`
  );
}

async function persistAndInferChunk(
  session: TwilioStreamState,
  pcmChunk: Buffer
) {
  const chunkPath = buildWavChunkFile(session, pcmChunk);
  try {
    const result = await sendToML(chunkPath, {
      sessionId: session.sessionId,
      callId: session.callId,
      chunkIndex: session.chunkIndex,
    });

    console.log("📞 Twilio chunk result:", {
      sessionId: session.sessionId,
      callId: session.callId,
      chunkIndex: session.chunkIndex,
      skip: result?.skip ?? result?.skipped ?? false,
      label: result?.final?.label ?? result?.label ?? "UNKNOWN",
      risk: result?.final?.risk ?? result?.risk ?? "UNKNOWN",
      confidence: result?.final?.confidence ?? result?.confidence ?? 0,
    });
  } finally {
    safeUnlink(chunkPath);
    session.chunkIndex += 1;
  }
}

function buildWavChunkFile(session: TwilioStreamState, pcmChunk: Buffer): string {
  const chunkPath = buildChunkPath(session);
  const wavBuffer = createWavBuffer(pcmChunk, INPUT_SAMPLE_RATE, INPUT_CHANNELS);
  fs.writeFileSync(chunkPath, wavBuffer);
  return chunkPath;
}

function normalizeSessionId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return randomUUID();
}

function normalizeCallId(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function initTwilioMediaWebSocket(server: any) {
  const wss = new WebSocketServer({
    server,
    path: "/api/twilio/media",
  });

  const sessions = new Map<string, TwilioStreamState>();

  wss.on("connection", (ws: WebSocket) => {
    console.log("📞 Twilio media websocket connected");

    let activeStreamSid: string | null = null;

    ws.on("message", async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as
          | TwilioConnectedMessage
          | TwilioStartMessage
          | TwilioMediaMessage
          | TwilioStopMessage
          | Record<string, any>;

        switch (msg.event as TwilioEventName) {
          case "connected": {
            console.log("📶 Twilio connected:", msg);
            break;
          }

          case "start": {
            const sessionId = normalizeSessionId(msg.start?.customParameters?.sessionId);
            const callId = normalizeCallId(
              msg.start?.customParameters?.callId,
              msg.start?.callSid || sessionId
            );

            activeStreamSid = msg.start.streamSid;

            const state: TwilioStreamState = {
              sessionId,
              callId,
              streamSid: msg.start.streamSid,
              accountSid: msg.start.accountSid,
              track: msg.start.tracks?.[0] ?? "inbound",
              chunkIndex: 0,
              pcmBuffer: Buffer.alloc(0),
              tempDir: createSessionTempDir(sessionId),
              startedAt: new Date().toISOString(),
              processing: Promise.resolve(),
              stopped: false,
            };

            sessions.set(msg.start.streamSid, state);

            console.log("🎯 Twilio stream started", {
              sessionId,
              callId,
              streamSid: msg.start.streamSid,
              tracks: msg.start.tracks,
              mediaFormat: msg.start.mediaFormat,
              customParameters: msg.start.customParameters,
            });

            break;
          }

          case "media": {
            const state = sessions.get(msg.streamSid || activeStreamSid || "");
            if (!state || state.stopped) return;

            const pcm = decodeMuLawBase64ToPcm16(msg.media.payload);
            state.pcmBuffer = Buffer.concat([state.pcmBuffer, pcm]);

            // Serialize chunk processing so chunks are emitted in order.
            state.processing = state.processing.then(async () => {
              while (state.pcmBuffer.length >= CHUNK_BYTES) {
                const chunk = state.pcmBuffer.subarray(0, CHUNK_BYTES);
                state.pcmBuffer = state.pcmBuffer.subarray(CHUNK_BYTES);

                await persistAndInferChunk(state, Buffer.from(chunk));
              }
            });

            break;
          }

          case "stop": {
            const streamSid = msg.streamSid || activeStreamSid || "";
            const state = sessions.get(streamSid);
            if (!state) return;

            state.stopped = true;

            await state.processing;

  
            if (state.pcmBuffer.length >= MIN_FINAL_CHUNK_BYTES) {
              const tail = Buffer.from(state.pcmBuffer);
              state.pcmBuffer = Buffer.alloc(0);
              await persistAndInferChunk(state, tail);
            }

            sessions.delete(streamSid);
            console.log("🛑 Twilio stream stopped", {
              sessionId: state.sessionId,
              callId: state.callId,
              streamSid,
            });

            break;
          }

          default:

            break;
        }
      } catch (err) {
        console.error("❌ Twilio media handler error:", err);
      }
    });

    ws.on("close", () => {
      if (activeStreamSid) {
        sessions.delete(activeStreamSid);
      }
      console.log("📴 Twilio media websocket disconnected");
    });
  });

  console.log("🔥 Twilio media websocket ready at /api/twilio/media");
}