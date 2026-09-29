import type { ReactNode } from "react";

export default function StructuredValue({ value, depth = 0, seen = new WeakSet<object>() }: {
  value: unknown;
  depth?: number;
  seen?: WeakSet<object>;
}) {
  if (value === null) return <span className="structured-null">null</span>;
  if (value === undefined) return <span className="structured-null">—</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="structured-scalar">{String(value)}</span>;
  }
  if (typeof value !== "object") return <span className="structured-scalar">{String(value)}</span>;
  if (seen.has(value)) return <span className="structured-null">[circular reference]</span>;
  if (depth >= 6) return <span className="structured-null">[nested detail omitted]</span>;
  seen.add(value);

  let content: ReactNode;
  if (Array.isArray(value)) {
    const visibleItems = value.slice(0, 30);
    content = (
      <ol className="structured-array">
        {visibleItems.map((item, index) => <li key={index}><StructuredValue value={item} depth={depth + 1} seen={seen} /></li>)}
        {value.length > visibleItems.length && <li className="structured-null">{value.length - visibleItems.length} additional entries</li>}
      </ol>
    );
  } else {
    const entries = Object.entries(value as Record<string, unknown>);
    const visibleEntries = entries.slice(0, 30);
    content = (
      <dl className="structured-object">
        {visibleEntries.map(([key, child]) => (
          <div className="structured-row" key={key}>
            <dt>{key}</dt><dd><StructuredValue value={child} depth={depth + 1} seen={seen} /></dd>
          </div>
        ))}
        {entries.length > visibleEntries.length && <div className="structured-row"><dt>REMAINDER</dt><dd>{entries.length - visibleEntries.length} additional entries</dd></div>}
      </dl>
    );
  }
  seen.delete(value);
  return content;
}
