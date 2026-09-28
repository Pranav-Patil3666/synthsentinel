import express from "express";
import cors from "cors";

import healthRoutes from "./routes/health.routes.js";
import dbRoutes from "./routes/db.routes.js";
import mlRoutes from "./routes/ml.routes.js";
import streamRoutes from "./routes/stream.routes.js";
import { twilioVoiceRouter } from "./routes/twilio_voice.route.js";
import { initTwilioMediaWebSocket } from "./ws/twilio_media.handler.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/db", dbRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/twilio", twilioVoiceRouter);

export default app;