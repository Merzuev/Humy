import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  ripple?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ripple = true,
  onClick,
  ...props
}: ButtonProps) {
  const [rippleEffect, setRippleEffect] = React.useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  
  const baseClasses = 'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden transform hover:scale-105 active:scale-95';
  
  const variants = {
    primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl hover:shadow-indigo-500/25 focus:ring-indigo-500',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white shadow-md hover:shadow-lg focus:ring-gray-500',
    outline: 'border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white hover:bg-gray-800 backdrop-blur-sm focus:ring-gray-500',
    ghost: 'text-gray-300 hover:text-white hover:bg-gray-800/50 backdrop-blur-sm focus:ring-gray-500'
  };
  
  const sizes = {
    sm: 'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm',
    md: 'px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm',
    lg: 'px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base'
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (ripple && !disabled && !loading) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setRippleEffect({ x, y, show: true });
      setTimeout(() => setRippleEffect(prev => ({ ...prev, show: false })), 600);
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {/* Ripple Effect */}
      {ripple && rippleEffect.show && (
        <span
          className="absolute bg-white/30 rounded-full animate-ping"
          style={{
            left: rippleEffect.x - 10,
            top: rippleEffect.y - 10,
            width: 20,
            height: 20,
          }}
        />
      )}
      
      {loading && (
        <Loader2 className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4" />
      )}
      {!loading && leftIcon && <span className="mr-1 sm:mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-1 sm:ml-2">{rightIcon}</span>}
    </button>
  );
}