import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  className?: string;
}

// ✅ Оборачиваем компонент в forwardRef
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ value, onChange, options, className = '', ...rest }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          value={value}
          onChange={onChange}
          className={`
            appearance-none rounded-lg border border-gray-600 bg-gray-800/90 backdrop-blur-sm
            px-2 sm:px-3 py-1 sm:py-1.5 pr-6 sm:pr-8 text-xs sm:text-sm text-white cursor-pointer
            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            transition-all duration-200
            ${className}
          `}
          {...rest}
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
);

Select.displayName = 'Select'; // нужно для отладки при использовании forwardRef
