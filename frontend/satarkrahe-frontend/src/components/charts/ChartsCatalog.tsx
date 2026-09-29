import { useMemo } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Gauge, useGaugeState } from "@mui/x-charts/Gauge";
import { PieChart } from "@mui/x-charts/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import { RadarChart } from "@mui/x-charts/RadarChart";
import type { AudioRuleDetails, DetectorResult, EnsembleWeights, MLInferenceResult, TemporalDetails } from "../../types/analysis";
import { formatDb, formatDuration, formatLatency, formatPercent, formatScore, formatThreshold } from "../../lib/format";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import { useChartColors } from "./chartTheme";
import ChartFrame, { type ChartRow } from "./ChartFrame";
import { sanitizeText } from "../../lib/privacy";

const present = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const rowsOf = (items: Array<[string, number | null | undefined, (value: number) => string]>): ChartRow[] => items.filter((item): item is [string, number, (value: number) => string] => present(item[1])).map(([label, value, formatter]) => ({ label, value: formatter(value) }));
const missingMessage = (empty: boolean) => empty;

function GaugeMarker({ threshold, color }: { threshold: number; color: string }) {
  const state = useGaugeState();
  const angle = state.startAngle + (state.endAngle - state.startAngle) * (threshold / state.valueMax);
  const inner = state.outerRadius - 5;
  const outer = state.outerRadius + 5;
  const x1 = state.cx + Math.cos(angle) * inner;
  const y1 = state.cy + Math.sin(angle) * inner;
  const x2 = state.cx + Math.cos(angle) * outer;
  const y2 = state.cy + Math.sin(angle) * outer;
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} aria-hidden="true" />;
}

export function VerdictGauge({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const value = result.final?.fake_prob;
  const threshold = result.final?.threshold;
  const rows = rowsOf([["FAKE PROBABILITY", value, formatPercent], ["FUSED DECISION THRESHOLD", threshold, formatThreshold]]);
  const risk = result.final?.risk;
  const color = risk === "HIGH" || result.final?.label === "FAKE" ? colors.destructive : risk === "MEDIUM" ? colors.warning : risk === "LOW" || result.final?.label === "REAL" ? colors.accent : colors.mutedForeground;
  return <ChartFrame title="VERDICT GAUGE" rows={rows} missing={missingMessage(!present(value))}>
    {present(value) && <Gauge value={value} valueMax={1} width={260} height={190} startAngle={-90} endAngle={90} innerRadius="72%" outerRadius="92%" skipAnimation={reducedMotion} text={() => formatPercent(value)} sx={{ "& .MuiGauge-valueArc": { fill: color, filter: `drop-shadow(0 0 5px ${color})` }, "& .MuiGauge-referenceArc": { fill: colors.border }, "& .MuiGauge-valueText": { fill: colors.foreground, fontFamily: '"Orbitron", monospace', fontSize: 20 } }}>{present(threshold) && <GaugeMarker threshold={threshold} color={colors.accentTertiary} />}</Gauge>}
  </ChartFrame>;
}

export function ProbabilityDonut({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const final = result.final;
  const available = present(final?.real_prob) && present(final?.fake_prob);
  const rows: ChartRow[] = available ? [{ label: "REAL", value: formatPercent(final.real_prob!) }, { label: "FAKE", value: formatPercent(final.fake_prob!) }, { label: "CONFIDENCE", value: formatPercent(final.confidence) }] : [];
  return <ChartFrame title="FINAL PROBABILITY SPLIT" rows={rows} missing={!available}>
    {available && <div className="donut-wrap"><PieChart width={260} height={205} skipAnimation={reducedMotion} colors={[colors.accent, colors.destructive]} series={[{ innerRadius: 63, outerRadius: 88, data: [{ id: "real", value: final.real_prob!, label: `REAL ${formatPercent(final.real_prob)}` }, { id: "fake", value: final.fake_prob!, label: `FAKE ${formatPercent(final.fake_prob)}` }] }]} />
      <span className="donut-center"><small>CONFIDENCE</small><strong>{formatPercent(final.confidence)}</strong></span>
      <ul className="chart-legend"><li><i className="legend-dot legend-dot--real" />REAL {formatPercent(final.real_prob)}</li><li><i className="legend-dot legend-dot--fake" />FAKE {formatPercent(final.fake_prob)}</li></ul></div>}
  </ChartFrame>;
}

function DetectorBadges({ result }: { result: MLInferenceResult }) {
  return <div className="detector-badges">{([["CNN", result.cnn], ["WAV2VEC2", result.wav2vec2], ["ENSEMBLE", result.final]] as const).map(([name, value]) => value && <span key={name}>{name}: {sanitizeText(value.label ?? "—")} / {sanitizeText(value.risk ?? "—")}</span>)}</div>;
}

function sources(result: MLInferenceResult): Array<{ name: string; data: DetectorResult | NonNullable<MLInferenceResult["final"]> }> {
  const items: Array<{ name: string; data: DetectorResult | NonNullable<MLInferenceResult["final"]> }> = [];
  if (result.cnn) items.push({ name: "CNN", data: result.cnn });
  if (result.wav2vec2) items.push({ name: "WAV2VEC2", data: result.wav2vec2 });
  if (result.final) items.push({ name: "ENSEMBLE", data: result.final });
  return items;
}

export function DetectorComparisonChart({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const items = sources(result);
  const categories = items.filter(({ data }) => present(data.fake_prob) || present(data.threshold));
  const thresholdName = (name: string) => name === "CNN" ? "CNN THRESHOLD" : name === "WAV2VEC2" ? "WAV2VEC2 THRESHOLD" : "FUSED DECISION THRESHOLD";
  const rows: ChartRow[] = categories.flatMap(({ name, data }) => rowsOf([[`${name} FAKE PROBABILITY`, data.fake_prob, formatPercent], [thresholdName(name), data.threshold, formatThreshold]]));
  return <ChartFrame title="DETECTOR COMPARISON" rows={rows} missing={categories.length === 0}>
    {categories.length > 0 && <><BarChart height={245} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: categories.map((x) => x.name) }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ label: "FAKE PROBABILITY", data: categories.map((x) => x.data.fake_prob ?? null), color: colors.destructive, valueFormatter: (v: number | null) => v == null ? "—" : formatPercent(v), barLabel: (item) => item.value == null ? null : formatPercent(item.value) }, { label: "THRESHOLD BY SOURCE", data: categories.map((x) => x.data.threshold ?? null), color: colors.accentTertiary, valueFormatter: (v: number | null) => v == null ? "—" : formatThreshold(v), barLabel: (item) => item.value == null ? null : formatThreshold(item.value) }]} grid={{ vertical: true }} /></>}
      <DetectorBadges result={result} />
  </ChartFrame>;
}

export function ProbabilityStackChart({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const entries = [["CNN", result.cnn], ["WAV2VEC2", result.wav2vec2], ["ENSEMBLE", result.final]] as const;
  const valid = entries.filter(([, d]) => d && (present(d.real_prob) || present(d.fake_prob)));
  const rows: ChartRow[] = valid.flatMap(([name, d]) => rowsOf([[`${name} REAL`, d?.real_prob, formatPercent], [`${name} FAKE`, d?.fake_prob, formatPercent]]));
  return <ChartFrame title="PROBABILITY STACK" caption="Returned probabilities by source" rows={rows} missing={valid.length === 0}>
    {valid.length > 0 && <BarChart height={210} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: valid.map(([name]) => name) }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ label: "REAL", stack: "probabilities", data: valid.map(([, d]) => d?.real_prob ?? null), color: colors.accent, valueFormatter: (v: number | null) => v == null ? "—" : formatPercent(v) }, { label: "FAKE", stack: "probabilities", data: valid.map(([, d]) => d?.fake_prob ?? null), color: colors.destructive, valueFormatter: (v: number | null) => v == null ? "—" : formatPercent(v) }]} grid={{ vertical: true }} />}
  </ChartFrame>;
}

export function RiskLadder({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const value = result.final?.fake_prob;
  const medium = result.thresholds?.medium_risk_threshold;
  const high = result.thresholds?.high_risk_threshold;
  const fused = result.final?.threshold;
  const rows = rowsOf([["FAKE PROBABILITY", value, formatPercent], ["MEDIUM RISK BAND", medium, formatThreshold], ["HIGH RISK BAND", high, formatThreshold], ["FUSED DECISION THRESHOLD", fused, formatThreshold]]);
  const hasBand = present(medium) && present(high);
  return <ChartFrame title="RISK LADDER" rows={rows} missing={!present(value)}>
    {present(value) && <><div className="risk-zones" aria-hidden="true">{hasBand && <><span style={{ width: `${Math.max(0, Math.min(100, medium * 100))}%` }} /><span style={{ width: `${Math.max(0, Math.min(100, (high - medium) * 100))}%` }} /><span style={{ width: `${Math.max(0, 100 - high * 100)}%` }} /></>}</div>
      <BarChart height={110} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: ["FINAL FAKE PROBABILITY"] }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ data: [value], color: colors.destructive, valueFormatter: (v: number | null) => v == null ? "—" : formatPercent(v) }]} grid={{ vertical: true }}>
        {present(medium) && <ChartsReferenceLine x={medium} label="MEDIUM RISK BAND" lineStyle={{ stroke: colors.warning, strokeDasharray: "4 3" }} />}
        {present(high) && <ChartsReferenceLine x={high} label="HIGH RISK BAND" lineStyle={{ stroke: colors.destructive, strokeDasharray: "4 3" }} />}
        {present(fused) && <ChartsReferenceLine x={fused} label="FUSED DECISION THRESHOLD" lineStyle={{ stroke: colors.accentTertiary, strokeDasharray: "2 2" }} />}
      </BarChart></>}
  </ChartFrame>;
}

function ensembleWeights(result: MLInferenceResult): EnsembleWeights | null {
  if (result.ensemble_weights) return result.ensemble_weights;
  if (result.ensemble?.meta?.weights) return result.ensemble.meta.weights;
  return { cnn: result.ensemble?.cnn?.weight, wav2vec2: result.ensemble?.wav2vec2?.weight };
}

export function ContributionDonut({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const weights = ensembleWeights(result);
  const data = weights ? ([ ["CNN", weights.cnn, colors.accent], ["WAV2VEC2", weights.wav2vec2, colors.accentTertiary], ["RULES", weights.rules, colors.accentSecondary] ] as const).filter(([, value]) => present(value) && value > 0).map(([label, value, color]) => ({ id: label, value: value as number, label: `${label} ${formatPercent(value)}`, color })) : [];
  const rows = data.map((x) => ({ label: x.id, value: formatPercent(x.value) }));
  const rulesZero = weights?.rules === 0;
  return <ChartFrame title="ENSEMBLE CONTRIBUTIONS" rows={rows} missing={!weights}>
    {data.length > 0 ? <div className="donut-wrap"><PieChart width={250} height={205} skipAnimation={reducedMotion} series={[{ innerRadius: 58, outerRadius: 86, data }]} />
      <ul className="chart-legend">{data.map((x) => <li key={x.id}><i className={`legend-dot legend-dot--${x.id.toLowerCase()}`} />{x.label}</li>)}</ul></div>
      : <div className="chart-missing">NOT PROVIDED</div>}
    {rulesZero && <p className="chart-note">RULES 0% — rules do not contribute to the weighted score</p>}
  </ChartFrame>;
}

export function FusionTraceChart({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const meta = result.ensemble?.meta;
  const items = [["WEIGHTED FAKE", meta?.weighted_fake], ["ADJUSTED FAKE", meta?.adjusted_fake], ["WEIGHTED THRESHOLD", meta?.weighted_threshold]] as const;
  const valid = items.filter(([, value]) => present(value));
  const rows = rowsOf(items.map(([name, value]) => [name, value, formatScore]));
  return <ChartFrame title="FUSION TRACE" caption="values as returned by the ensemble" rows={rows} missing={valid.length === 0}>
    {valid.length > 0 && <BarChart height={Math.max(130, valid.length * 50)} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: valid.map(([name]) => name) }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ data: valid.map(([, value]) => value ?? null), color: colors.accentSecondary, valueFormatter: (v: number | null) => v == null ? "—" : formatScore(v) }]} grid={{ vertical: true }} />}
  </ChartFrame>;
}

export function AgreementBars({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const consistency = result.rules?.details?.consistency;
  const items = [["AGREEMENT SCORE", result.ensemble?.agreement_score], ["DISAGREEMENT SCORE", result.ensemble?.disagreement_score], ["CONSISTENCY GAP", consistency?.gap], ["CONFIDENCE GAP", consistency?.confidence_gap]] as const;
  const valid = items.filter(([, value]) => present(value));
  const rows = rowsOf(items.map(([name, value]) => [name, value, formatScore]));
  const sameLabel = consistency?.same_label;
  return <ChartFrame title="AGREEMENT / DISAGREEMENT" rows={rows} missing={valid.length === 0 && sameLabel == null}>
    {valid.length > 0 ? <BarChart height={Math.max(140, valid.length * 42)} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: valid.map(([name]) => name) }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ data: valid.map(([, value]) => value ?? null), color: colors.accentTertiary, valueFormatter: (v: number | null) => v == null ? "—" : formatScore(v) }]} grid={{ vertical: true }} /> : <div className="chart-missing">NOT PROVIDED</div>}
    {sameLabel != null && <p className="chart-note">SAME LABEL: <strong>{sameLabel ? "YES" : "NO"}</strong></p>}
  </ChartFrame>;
}

export function RuleScoreChart({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const rules = result.rules;
  const items = [["AUDIO", rules?.audio?.score], ["TEMPORAL", rules?.temporal?.score], ["CONSISTENCY", rules?.consistency?.score]] as const;
  const valid = items.filter(([, value]) => present(value));
  const rows = rowsOf([["RULE SCORE", rules?.rule_score, formatScore], ...items.map(([n, v]) => [n, v, formatScore] as [string, number | null | undefined, (x: number) => string])]);
  const weights = rules?.meta?.weights;
  return <ChartFrame title="RULE ENGINE SCORES" rows={rows} missing={!rules}>
    {rules && <>{present(rules.rule_score) && <p className="chart-stat">RULE SCORE <strong>{formatScore(rules.rule_score)}</strong></p>}{valid.length > 0 ? <BarChart height={Math.max(130, valid.length * 43)} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: valid.map(([name]) => name) }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ data: valid.map(([, value]) => value ?? null), color: colors.warning, valueFormatter: (v: number | null) => v == null ? "—" : formatScore(v) }]} grid={{ vertical: true }} /> : <div className="chart-missing">NOT PROVIDED</div>}
      {weights && <p className="chart-note">RULE-ENGINE INTERNAL WEIGHTS — {Object.entries(weights).map(([key, value]) => `${key.toUpperCase()}: ${formatScore(value)}`).join(" / ")}</p>}</>}
  </ChartFrame>;
}

function AudioStatTiles({ details }: { details: AudioRuleDetails }) {
  const tiles = [["DYNAMIC RANGE", details.dynamic_range_db == null ? "—" : formatDb(details.dynamic_range_db)], ["DURATION", formatDuration(details.duration_sec)], ["SILENCE THRESHOLD", details.silence_threshold == null ? "—" : formatScore(details.silence_threshold)]];
  return <dl className="chart-stat-tiles">{tiles.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}

export function AudioDiagnosticsChart({ details }: { details?: AudioRuleDetails | null }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const items = [["SILENCE RATIO (%)", details?.silence_ratio, formatPercent], ["CLIPPING RATIO (%)", details?.clipping_ratio, formatPercent], ["RMS MEAN", details?.rms_mean, formatScore], ["RMS STD", details?.rms_std, formatScore], ["ZERO CROSSING RATE", details?.zcr_mean, formatScore], ["SPECTRAL FLATNESS", details?.flatness_mean, formatScore]] as const;
  const valid = items.filter(([, value]) => present(value));
  const rows = rowsOf(items.map(([name, value, format]) => [name, value, format]));
  return <ChartFrame title="AUDIO DIAGNOSTICS" rows={rows} missing={!details}>
    {details && <>{valid.length > 0 ? <BarChart height={Math.max(185, valid.length * 38)} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: valid.map(([name]) => name) }]} xAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatScore(v) }]} series={[{ data: valid.map(([, value]) => value ?? null), color: colors.accent, valueFormatter: (v: number | null, context: { dataIndex: number }) => v == null ? "—" : valid[context.dataIndex]?.[0].includes("RATIO") ? formatPercent(v) : formatScore(v) }]} grid={{ vertical: true }} /> : <div className="chart-missing">NOT PROVIDED</div>}<AudioStatTiles details={details} /></>}
  </ChartFrame>;
}

export function LatencyChart({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const items = [["CNN", result.cnn?.latency_ms], ["WAV2VEC2", result.wav2vec2?.latency_ms]] as const;
  const valid = items.filter(([, value]) => present(value));
  const rows = rowsOf(items.map(([name, value]) => [name, value, formatLatency]));
  return <ChartFrame title="DETECTOR LATENCY" rows={rows} missing={valid.length === 0}>
    {valid.length > 0 && <BarChart height={Math.max(110, valid.length * 45)} layout="horizontal" skipAnimation={reducedMotion} yAxis={[{ scaleType: "band", data: valid.map(([name]) => name) }]} xAxis={[{ valueFormatter: (v: number) => `${v} ms` }]} series={[{ label: "LATENCY", data: valid.map(([, value]) => value ?? null), color: colors.accentTertiary, valueFormatter: (v: number | null) => v == null ? "—" : formatLatency(v) }]} grid={{ vertical: true }} />}
  </ChartFrame>;
}

export function TemporalChart({ temporal }: { temporal?: TemporalDetails | null }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const probs = temporal?.probs?.filter((v): v is number => present(v)) ?? [];
  const labels = temporal?.labels ?? [];
  const rows = probs.map((value, index) => ({ label: `WINDOW ${index + 1}${labels[index] ? ` / ${sanitizeText(labels[index])}` : ""}`, value: formatScore(value) }));
  const stats: Array<[string, number | null | undefined]> = [["WINDOW", temporal?.window], ["HIGH HITS", temporal?.high_hits], ["MEDIUM HITS", temporal?.medium_hits], ["FAKE STREAK", temporal?.fake_streak], ["REAL STREAK", temporal?.real_streak], ["SPIKE DELTA", temporal?.spike_delta], ["FLIPS", temporal?.flips], ["SMOOTHED FAKE PROB", temporal?.smoothed_fake_prob], ["REGIME SHIFT", temporal?.regime_shift]];
  return <ChartFrame title="RULE-ENGINE TEMPORAL WINDOW" rows={rows} missing={!temporal}>
    {temporal && <>{probs.length > 0 ? <LineChart height={215} skipAnimation={reducedMotion} xAxis={[{ scaleType: "point", data: probs.map((_, i) => sanitizeText(labels[i] ?? `WINDOW ${i + 1}`)) }]} yAxis={[{ min: 0, max: 1, valueFormatter: (v: number) => formatPercent(v) }]} series={[{ label: "RULE-ENGINE TEMPORAL WINDOW", data: probs, color: colors.accentTertiary, showMark: probs.length === 1, valueFormatter: (v: number | null) => v == null ? "—" : formatScore(v) }]} grid={{ horizontal: true }} /> : <div className="chart-missing">NOT PROVIDED</div>}
      {probs.length === 1 && <p className="chart-note">SINGLE PROCESSED CHUNK</p>}
      <dl className="chart-stat-tiles">{stats.filter(([, value]) => value != null).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{formatScore(value)}</dd></div>)}</dl></>}
  </ChartFrame>;
}

function VoteTable({ votes }: { votes?: Record<string, number> | null }) {
  const grouped = useMemo(() => Object.entries(votes ?? {}).reduce<Record<string, Array<[string, number]>>>((acc, [key, value]) => {
    const [group, ...rest] = key.split(".");
    (acc[group] ??= []).push([rest.join("."), value]);
    return acc;
  }, {}), [votes]);
  const allZero = Object.values(grouped).flat().every(([, value]) => value === 0);
  if (!votes || Object.keys(votes).length === 0) return null;
  return <details className="vote-table" open={!allZero}><summary>{allZero ? "ALL ZERO — VIEW RULE VOTES" : "RULE VOTE BREAKDOWN"}</summary>
    {Object.entries(grouped).map(([group, values]) => <section key={group}><h5>{sanitizeText(group.toUpperCase())}</h5><dl>{values.map(([name, value]) => <div key={name} className={value !== 0 ? "vote-nonzero" : ""}><dt>{sanitizeText(name)}</dt><dd>{value}</dd></div>)}</dl></section>)}
  </details>;
}

export function VoteBreakdown({ result }: { result: MLInferenceResult }) {
  const session = result.session_summary;
  const votes = [["REAL VOTES", session?.real_votes], ["FAKE VOTES", session?.fake_votes], ["MEDIUM RISK VOTES", session?.medium_risk_votes], ["HIGH RISK VOTES", session?.high_risk_votes]] as const;
  const valid = votes.filter(([, value]) => present(value));
  const rows = rowsOf(votes.map(([name, value]) => [name, value, (x) => String(x)]));
  const verdictPair = [["REAL", session?.real_votes], ["FAKE", session?.fake_votes]] as const;
  const riskPair = [["MEDIUM RISK", session?.medium_risk_votes], ["HIGH RISK", session?.high_risk_votes]] as const;
  const segments = (title: string, pair: ReadonlyArray<readonly [string, number | null | undefined]>, className: string) => {
    const total = pair.reduce((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0);
    return <div className="vote-segment-group"><p>{title}</p><div className={`vote-segments ${className}`} role="img" aria-label={`${title}: ${pair.map(([name, value]) => `${name} ${value ?? "not provided"}`).join(", ")}`}>
      {pair.map(([name, value]) => typeof value === "number" && value > 0 && <span key={name} style={{ flexGrow: value }} />)}
      {total === 0 && <span className="vote-segments-empty" />}
    </div><p>{pair.map(([name, value]) => `${name} ${value ?? "—"}`).join(" / ")}</p></div>;
  };
  return <><ChartFrame title="SESSION VOTES" rows={rows} missing={!session}>
    {session && valid.length > 0 && <div className="vote-segments-panel">{segments("CLASSIFICATION VOTES", verdictPair, "vote-segments--verdict")}{segments("RISK VOTES", riskPair, "vote-segments--risk")}</div>}
  </ChartFrame><VoteTable votes={result.rules?.votes} /></>;
}

export function ModelSignatureRadar({ result }: { result: MLInferenceResult }) {
  const colors = useChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const entries = [["CNN", result.cnn], ["WAV2VEC2", result.wav2vec2]] as const;
  const available = entries.filter(([, d]) => d && [d.fake_prob, d.real_prob, d.confidence].every(present));
  const rows: ChartRow[] = available.flatMap(([name, d]) => rowsOf([[`${name} FAKE PROB`, d?.fake_prob, formatPercent], [`${name} REAL PROB`, d?.real_prob, formatPercent], [`${name} CONFIDENCE`, d?.confidence, formatPercent]]));
  return <ChartFrame title="MODEL SIGNATURE COMPARISON" rows={rows} missing={available.length === 0}>
    {available.length > 0 && <RadarChart height={290} skipAnimation={reducedMotion} radar={{ metrics: ["fake_prob", "real_prob", "confidence"], max: 1 }} series={available.map(([name, d]) => ({ label: name, data: [d!.fake_prob!, d!.real_prob!, d!.confidence!], fillArea: true }))} colors={[colors.accent, colors.accentTertiary]} />}
  </ChartFrame>;
}
