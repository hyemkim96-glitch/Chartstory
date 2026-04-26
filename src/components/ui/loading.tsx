import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin shrink-0", {
  variants: {
    size: {
      xs: "w-3 h-3",
      sm: "w-3.5 h-3.5",
      md: "w-4 h-4",
      lg: "w-5 h-5",
      xl: "w-6 h-6",
    },
    color: {
      brand: "text-brand",
      muted: "text-secondary",
      primary: "text-primary",
    },
  },
  defaultVariants: {
    size: "md",
    color: "brand",
  },
});

type SpinnerProps = VariantProps<typeof spinnerVariants> & {
  className?: string;
};

function Spinner({ size, color, className }: SpinnerProps) {
  return (
    <Loader2
      data-slot="spinner"
      className={cn(spinnerVariants({ size, color }), className)}
    />
  );
}

const colorClass: Record<NonNullable<SpinnerProps["color"]>, string> = {
  brand: "text-brand",
  muted: "text-secondary",
  primary: "text-primary",
};

interface LoadingProps extends SpinnerProps {
  variant?: "spinner" | "inline" | "section";
  label?: string;
}

function Loading({
  variant = "spinner",
  size,
  color = "brand",
  label,
  className,
}: LoadingProps) {
  if (variant === "inline") {
    return (
      <span
        data-slot="loading"
        data-variant="inline"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          colorClass[color],
          className
        )}
      >
        <Spinner size={size ?? "sm"} color={color} />
        {label}
      </span>
    );
  }

  if (variant === "section") {
    return (
      <div
        data-slot="loading"
        data-variant="section"
        className={cn(
          "flex flex-col items-center justify-center py-20 gap-3 px-5",
          className
        )}
      >
        <Spinner size={size ?? "lg"} color={color} />
        {label && (
          <p className="text-xs text-secondary text-center leading-relaxed">
            {label}
          </p>
        )}
      </div>
    );
  }

  return <Spinner size={size} color={color} className={className} />;
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-sm", className)}
      {...props}
    />
  );
}

export { Loading, Spinner, Skeleton, spinnerVariants };
export type { LoadingProps, SpinnerProps };
