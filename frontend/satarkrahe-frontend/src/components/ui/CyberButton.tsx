import type { ButtonHTMLAttributes } from "react";

type CyberButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
};

export default function CyberButton({
  children,
  className = "",
  variant = "secondary",
  ...props
}: CyberButtonProps) {
  return (
    <button className={`cyber-button cyber-button--${variant} hover:animate-glitch ${className}`} {...props}>
      {children}
    </button>
  );
}
