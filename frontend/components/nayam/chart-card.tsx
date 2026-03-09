import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function ChartCard({ title, subtitle, children, className, action }: ChartCardProps) {
  return (
    <div
      className={cn(
        "border-3 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px] shadow-foreground/20",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-card-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
