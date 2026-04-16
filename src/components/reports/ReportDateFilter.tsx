import { useState, useMemo } from "react";
import { addDays } from "date-fns";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, parse, isValid } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRange {
  start: string; // ISO yyyy-MM-dd
  end: string;   // ISO yyyy-MM-dd
  label: string;
}

type Preset = { label: string; getRange: () => { start: Date; end: Date } };

const PRESETS: Preset[] = [
  {
    label: "Today",
    getRange: () => ({ start: new Date(), end: new Date() }),
  },
  {
    label: "Yesterday",
    getRange: () => {
      const y = subDays(new Date(), 1);
      return { start: y, end: y };
    },
  },
  {
    label: "Tomorrow",
    getRange: () => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return { start: t, end: t };
    },
  },
  {
    label: "Next Week",
    getRange: () => {
      const today = new Date();
      const nextMon = startOfWeek(addDays(today, 7), { weekStartsOn: 1 });
      const nextSun = endOfWeek(addDays(today, 7), { weekStartsOn: 1 });
      return { start: nextMon, end: nextSun };
    },
  },
  {
    label: "This Month",
    getRange: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }),
  },
  {
    label: "Last Month",
    getRange: () => {
      const prev = subMonths(new Date(), 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    },
  },
  {
    label: "Last 7 Days",
    getRange: () => ({ start: subDays(new Date(), 6), end: new Date() }),
  },
  {
    label: "Last 30 Days",
    getRange: () => ({ start: subDays(new Date(), 29), end: new Date() }),
  },
  {
    label: "Last 3 Months",
    getRange: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }),
  },
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function useReportDateRange(initialPreset: string = "This Month"): [DateRange, (r: DateRange) => void] {
  const preset = PRESETS.find((p) => p.label === initialPreset) ?? PRESETS[0];
  const initial = preset.getRange();
  const [range, setRange] = useState<DateRange>({
    start: format(initial.start, "yyyy-MM-dd"),
    end: format(initial.end, "yyyy-MM-dd"),
    label: preset.label,
  });
  return [range, setRange];
}

export function ReportDateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const displayLabel = useMemo(() => {
    if (value.label && value.label !== "Custom") return value.label;
    const s = parse(value.start, "yyyy-MM-dd", new Date());
    const e = parse(value.end, "yyyy-MM-dd", new Date());
    if (isValid(s) && isValid(e)) {
      return `${format(s, "dd/MM/yyyy")} – ${format(e, "dd/MM/yyyy")}`;
    }
    return "Select dates";
  }, [value]);

  const handlePreset = (preset: Preset) => {
    const r = preset.getRange();
    onChange({
      start: format(r.start, "yyyy-MM-dd"),
      end: format(r.end, "yyyy-MM-dd"),
      label: preset.label,
    });
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      const start = customFrom <= customTo ? customFrom : customTo;
      const end = customFrom <= customTo ? customTo : customFrom;
      onChange({
        start: format(start, "yyyy-MM-dd"),
        end: format(end, "yyyy-MM-dd"),
        label: "Custom",
      });
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          {displayLabel}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets */}
          <div className="border-r border-border p-2 space-y-0.5 min-w-[140px]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 font-medium">Quick Select</p>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className={cn(
                  "w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors hover:bg-accent",
                  value.label === p.label && "bg-accent text-accent-foreground font-medium"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range calendars */}
          <div className="p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Custom Range</p>
            <div className="flex gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">From</p>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  className="p-2 pointer-events-auto"
                  classNames={{ day_selected: "bg-primary text-primary-foreground" }}
                />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">To</p>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  className="p-2 pointer-events-auto"
                  classNames={{ day_selected: "bg-primary text-primary-foreground" }}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full text-xs"
              disabled={!customFrom || !customTo}
              onClick={handleApplyCustom}
            >
              Apply Range
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
