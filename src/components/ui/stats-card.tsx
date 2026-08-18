// components/ui/stats-card.tsx
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  isCurrency?: boolean;
  valueColor?: string;
  description?: string;
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  className,
  isCurrency = false,
  valueColor,
  description
}: StatsCardProps) {
  // Formatar valor se for moeda
  const formattedValue = isCurrency && typeof value === 'number' 
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
      }).format(value)
    : value;

  return (
    <Card className={cn(
      "relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300",
      className
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <h3 
              className={cn(
                "text-3xl font-bold text-foreground bg-clip-text",
                valueColor
              )}
            >
              {formattedValue}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "text-xs font-semibold flex items-center gap-1",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}% vs. mês anterior
              </p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}