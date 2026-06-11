import type { ButtonHTMLAttributes, ReactNode } from "react";

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  children: ReactNode;
}

export function TextButton({
  icon,
  children,
  type = "button",
  ...props
}: TextButtonProps) {
  return (
    <button type={type} className="text-button" {...props}>
      {icon}
      {children}
    </button>
  );
}
