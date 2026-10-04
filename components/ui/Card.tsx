import { cva, type VariantProps } from "class-variance-authority";
import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const cardVariants = cva("panel", {
  variants: {
    padding: { default: "p-5 sm:p-6", compact: "p-4", none: "p-0" },
  },
  defaultVariants: { padding: "default" },
});

interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, padding, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ padding }), className)} {...props} />
));

Card.displayName = "Card";

export default Card;
