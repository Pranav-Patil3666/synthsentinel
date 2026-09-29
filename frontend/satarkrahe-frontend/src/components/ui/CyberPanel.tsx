import type { HTMLAttributes, ReactNode } from "react";

type CyberPanelProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  eyebrow?: string;
  headingLevel?: 2 | 3;
  children: ReactNode;
};

export default function CyberPanel({
  title,
  eyebrow,
  headingLevel = 2,
  children,
  className = "",
  ...props
}: CyberPanelProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section className={`cyber-panel ${className}`} {...props}>
      {(title || eyebrow) && (
        <header className="panel-heading">
          <span className="panel-mark" aria-hidden="true" />
          <div>
            {eyebrow && <p className="panel-eyebrow">{eyebrow}</p>}
            {title && <Heading>{title}</Heading>}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}
