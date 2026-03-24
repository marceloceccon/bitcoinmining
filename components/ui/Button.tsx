import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-deep/30 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:pointer-events-none",
          "active:scale-[0.98]",
          {
            "bg-white/60 text-slate-700 border border-slate-200/70 hover:bg-white/80 hover:shadow-sm rounded-xl":
              variant === "default",
            "bg-blueprint-deep text-white hover:bg-blue-800 shadow-md hover:shadow-lg rounded-xl":
              variant === "primary",
            "text-slate-600 hover:bg-white/50 hover:text-slate-900 rounded-xl":
              variant === "ghost",
            "bg-red-500 text-white hover:bg-red-600 shadow-sm rounded-xl":
              variant === "destructive",
          },
          {
            "h-10 px-4 py-2 text-sm": size === "default",
            "h-9 px-3 text-sm": size === "sm",
            "h-11 px-8": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;
