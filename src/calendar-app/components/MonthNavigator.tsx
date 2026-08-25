import { addMonths, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthTitle } from "../utils";

export default function MonthNavigator({
  month,
  onChange,
}: {
  month: Date;
  onChange: (date: Date) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Mês anterior"
        onClick={() => onChange(subMonths(month, 1))}
        className="h-9 w-9 shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <h2 className="min-w-[9.5rem] text-center font-display text-lg font-semibold sm:min-w-[11rem] sm:text-xl">
        {formatMonthTitle(month)}
      </h2>
      <Button
        variant="outline"
        size="icon"
        aria-label="Próximo mês"
        onClick={() => onChange(addMonths(month, 1))}
        className="h-9 w-9 shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(startOfMonth(new Date()))}
        className="ml-1 hidden text-muted-foreground hover:text-foreground sm:inline-flex"
      >
        Hoje
      </Button>
    </div>
  );
}
