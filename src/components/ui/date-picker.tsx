"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerProps {
  id?: string;
  value?: string; // YYYY-MM-DD format
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  allowPastYears?: boolean;
  required?: boolean;
}

export function DatePicker({
  id,
  value,
  onChange,
  className,
  placeholder = "YYYY-MM-DD",
  allowPastYears = false,
  required = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value || "");

  // Update input text when value changes externally (e.g. from the calendar)
  React.useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  let dateObj: Date | undefined = undefined;
  if (value) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) dateObj = parsed;
  }

  const handleSelect = (d: Date | undefined) => {
    const newVal = d ? format(d, "yyyy-MM-dd") : "";
    setInputValue(newVal);
    if (onChange) onChange(newVal);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (inputValue.trim() === "") {
      if (onChange) onChange("");
      return;
    }
    
    // Attempt to parse YYYY-MM-DD
    const parsed = parse(inputValue, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) {
      if (onChange) onChange(format(parsed, "yyyy-MM-dd"));
    } else {
      // Just pass the text so native form validation handles required state or custom logic handles the error
      if (onChange) onChange(inputValue);
    }
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Input
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        required={required}
        pattern="\d{4}-\d{2}-\d{2}"
        title="Format: YYYY-MM-DD"
        className="w-full pr-10 bg-background"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="absolute right-0 top-0 h-full w-10 text-fg-muted hover:text-foreground hover:bg-transparent"
          >
            <CalendarIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-border/50" align="end">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleSelect}
            autoFocus
            captionLayout={allowPastYears ? "dropdown" : "label"}
            startMonth={allowPastYears ? new Date(1900, 0) : undefined}
            endMonth={allowPastYears ? new Date(new Date().getFullYear() + 10, 11) : undefined}
            className="p-4 [--cell-size:2.25rem]"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

