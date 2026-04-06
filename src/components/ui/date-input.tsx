import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateInputProps {
  /** ISO date string (YYYY-MM-DD) */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * A styled date input that displays DD/MM/YYYY and stores ISO (YYYY-MM-DD).
 * Includes a popover calendar picker.
 */
export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
  disabled,
  required,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");

  // Sync text from value
  React.useEffect(() => {
    if (value) {
      const d = parse(value, "yyyy-MM-dd", new Date());
      if (isValid(d)) {
        setText(format(d, "dd/MM/yyyy"));
        return;
      }
    }
    setText("");
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d/]/g, "");

    // Auto-insert slashes
    const digits = raw.replace(/\//g, "");
    if (digits.length >= 4) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    } else if (digits.length >= 2) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2);
    }
    setText(raw);

    // Try parse complete date
    if (raw.length === 10) {
      const d = parse(raw, "dd/MM/yyyy", new Date());
      if (isValid(d) && d.getFullYear() > 1900) {
        onChange(format(d, "yyyy-MM-dd"));
        return;
      }
    }

    // Clear if empty
    if (raw.length === 0) {
      onChange("");
    }
  };

  const handleCalendarSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        value={text}
        onChange={handleTextChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={10}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 h-full w-9 rounded-l-none text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={isValid(selectedDate) ? selectedDate : undefined}
            onSelect={handleCalendarSelect}
            defaultMonth={isValid(selectedDate) ? selectedDate : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
