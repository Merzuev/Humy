import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

export function Select({ value, onChange, options, className = '' }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          appearance-none rounded-lg border border-gray-600 bg-gray-800/90 backdrop-blur-sm
          px-2 sm:px-3 py-1 sm:py-1.5 pr-6 sm:pr-8 text-xs sm:text-sm text-white cursor-pointer
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          transition-all duration-200
          ${className}
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}