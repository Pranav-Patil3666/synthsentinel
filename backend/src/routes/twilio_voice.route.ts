import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import twilio from "twilio";

const { VoiceResponse } = twilio.twiml;

export const twilioVoiceRouter = Router();

function getMediaStreamUrl(): string {
  const url = process.env.TWILIO_MEDIA_STREAM_URL;
  if (!url) {
    throw new Error(
      "TWILIO_MEDIA_STREAM_URL is not set. It must be a wss:// URL."
    );
  }
  return url;
}

twilioVoiceRouter.post("/voice", async (req: Request, res: Response) => {
  try {
    const callSid = String(req.body?.CallSid ?? req.body?.callSid ?? "");
    const from = String(req.body?.From ?? req.body?.from ?? "");
    const to = String(req.body?.To ?? req.body?.to ?? "");
    const direction = String(req.body?.Direction ?? req.body?.direction ?? "inbound");
    const sessionId = randomUUID();

    const mediaUrl = getMediaStreamUrl();

    const response = new VoiceResponse();
    const start = response.start();

    const stream = start.stream({
      name: `SynthSentinel-${callSid || sessionId}`,
      url: mediaUrl,
    });

    stream.parameter({
      name: "sessionId",
      value: sessionId,
    });

    stream.parameter({
      name: "callId",
      value: callSid || sessionId,
    });

    stream.parameter({
      name: "from",
      value: from || "unknown",
    });

    stream.parameter({
      name: "to",
      value: to || "unknown",
    });

    stream.parameter({
      name: "direction",
      value: direction,
    });

    stream.parameter({
      name: "source",
      value: "twilio_voice",
    });


    response.say(
      { voice: "alice" },
      "Monitoring started. Please continue speaking normally."
    );
    response.pause({ length: 600 });

    res.type("text/xml").send(response.toString());
  } catch (error: any) {
    res.status(500).type("text/plain").send(error.message || "Twilio voice webhook error");
  }
});