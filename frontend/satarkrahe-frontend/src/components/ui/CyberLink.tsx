import { Link, type LinkProps } from "react-router-dom";

type CyberLinkProps = LinkProps & {
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

export default function CyberLink({
  children,
  className = "",
  variant = "secondary",
  ...props
}: CyberLinkProps) {
  return (
    <Link className={`cyber-button cyber-button--${variant} hover:animate-glitch ${className}`} {...props}>
      {children}
    </Link>
  );
}
