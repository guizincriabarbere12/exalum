import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useNotificacoes } from "@/hooks/useNotificacoes";

export function NotificationBell() {
  const { itens, total } = useNotificacoes();
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 transition-colors">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b">
          <p className="font-semibold text-sm">Notificações</p>
        </div>
        {itens.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma pendência no momento</p>
        ) : (
          <div className="p-1">
            {itens.map((item) => (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
              >
                <span>{item.label}</span>
                <Badge variant="destructive">{item.count}</Badge>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
