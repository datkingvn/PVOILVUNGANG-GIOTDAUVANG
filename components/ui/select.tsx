"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Chọn...",
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-2 text-left",
          "bg-gradient-to-br from-gray-800 to-gray-900",
          "border border-gray-700 rounded-lg",
          "text-white",
          "flex items-center justify-between",
          "hover:border-gray-600 transition-colors"
        )}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown
          size={16}
          className={cn("transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute z-10 w-full mt-1",
            "bg-gradient-to-br from-gray-800 to-gray-900",
            "border border-gray-700 rounded-lg shadow-lg",
            "max-h-60 overflow-y-auto"
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-4 py-2 text-left text-white",
                "hover:bg-gray-700 transition-colors",
                value === option.value && "bg-gray-700"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

