import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded border border-line bg-surface px-3 py-2",
          "text-sm text-fg ring-offset-background file:border-0 file:bg-transparent",
          "file:text-sm file:font-medium placeholder:text-faint",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 focus-visible:border-line-strong",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;
