import CyberLink from "../components/ui/CyberLink";

export default function NotFoundPage() {
  return (
    <section className="not-found-page page-container" aria-labelledby="not-found-title">
      <p className="eyebrow">ROUTE ERROR / 404</p>
      <h1 className="section-title" id="not-found-title">SIGNAL<br /><span>NOT FOUND</span></h1>
      <p className="page-subtitle">THE REQUESTED PATH IS NOT REGISTERED.</p>
      <CyberLink to="/" variant="secondary">RETURN TO HOME <span aria-hidden="true">→</span></CyberLink>
    </section>
  );
}
