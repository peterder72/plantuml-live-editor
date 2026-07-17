import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface TextButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  children: ReactNode;
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
  function TextButton(
    { icon, children, type = "button", ...props },
    ref,
  ) {
    return (
      <button ref={ref} type={type} className="text-button" {...props}>
        {icon}
        {children}
      </button>
    );
  },
);
