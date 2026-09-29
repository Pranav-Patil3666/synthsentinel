import type { ReactNode } from "react";

export type ChartRow = { label: string; value: string };
type ChartFrameProps = { title: string; caption?: string; rows?: ChartRow[]; missing?: boolean; children: ReactNode };

export default function ChartFrame({ title, caption, rows = [], missing = false, children }: ChartFrameProps) {
  return (
    <figure className="chart-frame" aria-label={`${title} chart`}>
      <figcaption className="chart-frame-heading"><h4>{title}</h4>{caption && <p>{caption}</p>}</figcaption>
      {missing ? <div className="chart-missing" role="status">NOT PROVIDED</div> : <div className="chart-stage">{children}</div>}
      {!missing && rows.length > 0 && <details className="chart-data"><summary>VIEW NUMERIC VALUES</summary><table><caption className="sr-only">{title} values</caption><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table></details>}
    </figure>
  );
}
