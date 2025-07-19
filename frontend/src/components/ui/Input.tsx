import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
  animated?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  helperText,
  animated = true,
  className = '',
  ...props
}, ref) => {
  const hasError = !!error;
  const [isFocused, setIsFocused] = React.useState(false);
  const [hasValue, setHasValue] = React.useState(!!props.value || !!props.defaultValue);
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (props.onFocus) props.onFocus(e);
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (props.onBlur) props.onBlur(e);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(!!e.target.value);
    if (props.onChange) props.onChange(e);
  };
  
  return (
    <div className="w-full">
      <div className="relative">
        {label && !animated && (
          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        
        {/* Animated floating label */}
        {label && animated && (
          <label className={`
            absolute left-3 transition-all duration-200 pointer-events-none z-10
            ${leftIcon ? 'left-9 sm:left-10' : 'left-3'}
            ${isFocused || hasValue 
              ? 'top-1 text-xs text-indigo-400 bg-gray-800 px-1 rounded' 
              : 'top-1/2 -translate-y-1/2 text-sm text-gray-400'
            }
          `}>
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <div className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-200 ${
                isFocused ? 'text-indigo-400' : 'text-gray-400'
              }`}>
                {leftIcon}
              </div>
            </div>
          )}
          <input
            ref={ref}
            className={`
              block w-full rounded-lg border transition-all duration-200
              ${leftIcon ? 'pl-9 sm:pl-10' : 'pl-3'}
              ${rightIcon ? 'pr-9 sm:pr-10' : 'pr-3'}
              ${animated && label ? 'pt-6 pb-2' : 'py-2 sm:py-2.5'}
              text-xs sm:text-sm backdrop-blur-sm
              ${hasError 
                ? 'border-red-500 bg-red-500/10 text-red-300 placeholder-red-400 focus:border-red-400 focus:ring-red-500/20' 
                : isFocused
                  ? 'border-indigo-500 bg-indigo-500/10 text-white placeholder-gray-400 focus:border-indigo-400 focus:ring-indigo-500/20'
                  : 'border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 hover:border-gray-500'
              }
              focus:outline-none focus:ring-2 focus:ring-offset-0
              ${className}
            `}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className={`h-4 w-4 sm:h-5 sm:w-5 cursor-pointer transition-colors duration-200 ${
                isFocused ? 'text-indigo-400 hover:text-indigo-300' : 'text-gray-400 hover:text-gray-300'
              }`}>
                {rightIcon}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mt-1.5 flex items-center space-x-1">
          <div className="w-1 h-1 bg-red-400 rounded-full animate-pulse"></div>
          <p className="text-xs sm:text-sm text-red-400 animate-in slide-in-from-left-2 duration-200">{error}</p>
        </div>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs sm:text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';