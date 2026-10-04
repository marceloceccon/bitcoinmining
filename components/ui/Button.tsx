import { cva, type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 rounded font-medium",
    "transition-colors duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        default: "border border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg aria-pressed:border-fg aria-pressed:text-fg",
        primary: "bg-fg text-bg hover:bg-fg/85 aria-pressed:bg-fg",
        ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
        destructive: "bg-bad text-bg hover:bg-bad/85",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));

Button.displayName = "Button";

export default Button;
