import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBannerProps {
  type: "warning" | "danger" | "info" | "success";
  title: string;
  description: string;
  action?: string;
  className?: string;
}

export function AlertBanner({
  type,
  title,
  description,
  action,
  className,
}: AlertBannerProps) {
  const icons = {
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    danger: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  };

  const bgStyles = {
    warning: "bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200",
    danger: "bg-rose-500/10 border-rose-500/25 text-rose-900 dark:text-rose-200",
    info: "bg-blue-500/10 border-blue-500/25 text-blue-900 dark:text-blue-200",
    success: "bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-200",
  };

  return (
    <div
      className={cn(
        "flex items-start space-x-3 rounded-xl border p-4 text-sm transition-all duration-150 shadow-sm",
        bgStyles[type],
        className
      )}
    >
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1 space-y-1">
        <h4 className="font-semibold text-sm leading-tight">{title}</h4>
        <p className="text-xs opacity-90 leading-relaxed">{description}</p>
        {action && (
          <div className="mt-2 text-xs font-medium pt-1 border-t border-current/10">
            <span className="font-semibold">Action:</span> {action}
          </div>
        )}
      </div>
    </div>
  );
}
