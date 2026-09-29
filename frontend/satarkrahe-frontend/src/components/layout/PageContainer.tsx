import type { HTMLAttributes, ReactNode } from "react";

type PageContainerProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export default function PageContainer({ children, className = "", ...props }: PageContainerProps) {
  return <div className={`page-container ${className}`} {...props}>{children}</div>;
}
