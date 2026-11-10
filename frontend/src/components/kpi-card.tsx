import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  delta,
  deltaType = "positive",
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/80",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {icon && <div className="text-muted-foreground/70">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              deltaType === "positive" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              deltaType === "negative" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              deltaType === "neutral" && "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            {delta}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
