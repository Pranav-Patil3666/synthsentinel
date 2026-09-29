type FoundationRouteProps = {
  index: string;
  title: string;
  path: string;
};

export default function FoundationRoute({ index, title, path }: FoundationRouteProps) {
  return (
    <section aria-labelledby="page-title" className="route-page">
      <p className="eyebrow">SYSTEM ROUTE / {index}</p>
      <h1 className="page-title" id="page-title">{title}</h1>
      <div className="cyber-panel">
        <div className="panel-heading">
          <span className="status-mark" aria-hidden="true" />
          <h2>FOUNDATION READY</h2>
        </div>
        <dl className="route-details">
          <div>
            <dt>PATH</dt>
            <dd>{path}</dd>
          </div>
          <div>
            <dt>STATUS</dt>
            <dd>EXPERIENCE SCHEDULED FOR A LATER PHASE</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
