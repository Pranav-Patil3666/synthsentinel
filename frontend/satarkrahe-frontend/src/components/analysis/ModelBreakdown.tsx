import CyberPanel from "../ui/CyberPanel";
import StructuredValue from "./StructuredValue";

type ModelBreakdownProps = {
  cnn?: unknown;
  wav2vec2?: unknown;
  rules?: unknown;
  ensemble?: unknown;
};

function ModelPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <CyberPanel title={title} headingLevel={3} className="result-panel model-panel">
      <div className="structured-content"><StructuredValue value={data} /></div>
    </CyberPanel>
  );
}

export default function ModelBreakdown({ cnn, wav2vec2, rules, ensemble }: ModelBreakdownProps) {
  return (
    <section className="model-breakdown" aria-labelledby="model-breakdown-title">
      <div className="results-subheading"><p className="eyebrow">EVIDENCE CHANNELS</p><h3 id="model-breakdown-title">MODEL BREAKDOWN</h3></div>
      <div className="model-grid">
        <ModelPanel title="CNN" data={cnn} />
        <ModelPanel title="WAV2VEC2" data={wav2vec2} />
        <ModelPanel title="RULES" data={rules} />
        <ModelPanel title="ENSEMBLE" data={ensemble} />
      </div>
    </section>
  );
}
