import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  error?: string;
  onSearch?: (query: string) => Option[];
  leftIcon?: React.ReactNode;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  error,
  onSearch,
  leftIcon,
  disabled = false
}: SearchableSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    if (onSearch) {
      setFilteredOptions(onSearch(searchQuery));
    } else {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchQuery, options, onSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={handleToggle}
        className={`
          relative flex items-center w-full rounded-lg border transition-all duration-200 cursor-pointer
          ${leftIcon ? 'pl-9 sm:pl-10' : 'pl-3'} pr-8 sm:pr-10 py-2 sm:py-2.5 text-xs sm:text-sm
          ${error 
            ? 'border-red-500 bg-red-500/10 text-red-300' 
            : 'border-gray-600 bg-gray-800/50 text-white hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''}
          ${className}
        `}
      >
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400 h-4 w-4 sm:h-5 sm:w-5">
              {leftIcon}
            </div>
          </div>
        )}
        
        <span className={`flex-1 truncate ${selectedOption ? 'text-white' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
          {selectedOption && !disabled && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              type="button"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 hover:text-gray-300" />
            </button>
          )}
          <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-600">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.searchPlaceholder', 'Search...')}
                className="w-full pl-8 sm:pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className={`
                    w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-gray-700 transition-colors
                    ${option.value === value ? 'bg-indigo-600 text-white' : 'text-gray-300'}
                  `}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs sm:text-sm text-gray-400">
                {t('common.noOptionsFound', 'No options found')}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs sm:text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}