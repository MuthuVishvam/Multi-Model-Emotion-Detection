// Common Button component with multiple variants
import React from 'react';

export const Button = React.forwardRef(({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className = '',
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70';

  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-950/20 active:scale-95',
    secondary: 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 active:scale-95',
    outline: 'border border-brand-400/50 text-brand-200 hover:bg-brand-500/10 active:scale-95',
    ghost: 'text-slate-200 hover:bg-slate-800 active:scale-95',
    danger: 'bg-red-600 text-white hover:bg-red-500 active:scale-95',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95',
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs gap-1',
    sm: 'px-3 py-2 text-sm gap-2',
    md: 'px-4 py-2.5 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-3',
    xl: 'px-8 py-4 text-xl gap-3',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <LoadingSpinner size={size} />}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

// Loading spinner component
const LoadingSpinner = ({ size = 'md' }) => {
  const sizeMap = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };
  return (
    <div className="inline-block animate-spin">
      <div className="border-2 border-current border-t-transparent rounded-full"
        style={{ width: sizeMap[size], height: sizeMap[size] }} />
    </div>
  );
};

// Card component
export const Card = ({ children, className = '', ...props }) => (
  <div
    className={`safe-card p-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

// Modal component
export const Modal = ({ isOpen, onClose, title, children, footer, className = '' }) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 safe-card z-50 w-full max-w-md mx-4 ${className}`}>
        <div className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">{footer}</div>}
      </div>
    </>
  );
};

// Input component
export const Input = React.forwardRef(({
  label,
  error,
  helper,
  icon: Icon,
  className = '',
  ...props
}, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-200 mb-2">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />}
      <input
        ref={ref}
        className={`safe-input ${Icon ? 'pl-10' : 'px-3'} ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
    </div>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    {helper && <p className="text-slate-400 text-sm mt-1">{helper}</p>}
  </div>
));

Input.displayName = 'Input';

// Badge component
export const Badge = ({ children, variant = 'blue', size = 'md' }) => {
  const variants = {
    blue: 'bg-blue-500/15 text-blue-200 border border-blue-400/30',
    green: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
    red: 'bg-red-500/15 text-red-200 border border-red-400/30',
    yellow: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
    gray: 'bg-slate-800 text-slate-200 border border-slate-700',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs rounded',
    md: 'px-3 py-1.5 text-sm rounded-md',
    lg: 'px-4 py-2 text-base rounded-lg',
  };

  return <span className={`font-medium ${variants[variant]} ${sizes[size]}`}>{children}</span>;
};

// Toast component (simplified - use react-hot-toast in real app)
export const Toast = ({ message, type = 'info' }) => {
  const types = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
  };

  return (
    <div className={`${types[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2`}>
      {message}
    </div>
  );
};

// Loading skeleton component
export const Skeleton = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div className={`skeleton rounded ${width} ${height} ${className}`} />
);

// Avatar component
export const Avatar = ({ src, alt = 'User', size = 'md', status }) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  return (
    <div className="relative inline-block">
      {src ? (
        <img src={src} alt={alt} className={`${sizeMap[size]} rounded-full object-cover`} />
      ) : (
        <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold`}>
          {alt.charAt(0)}
        </div>
      )}
      {status && (
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
      )}
    </div>
  );
};

// Dropdown/Menu component
export const Dropdown = ({ trigger, children, align = 'left' }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div className={`absolute top-full mt-2 safe-card z-50 min-w-max ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children}
        </div>
      )}
    </div>
  );
};

// Pagination component
export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </Button>

      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let page;
        if (totalPages <= 5) {
          page = i + 1;
        } else if (currentPage <= 3) {
          page = i + 1;
        } else if (currentPage >= totalPages - 2) {
          page = totalPages - 4 + i;
        } else {
          page = currentPage - 2 + i;
        }

        return (
          <Button
            key={page}
            variant={currentPage === page ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </Button>
    </div>
  );
};

// Loading overlay component
export const LoadingOverlay = ({ isVisible, message = 'Loading...' }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="safe-card p-8 flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-slate-300">{message}</p>
      </div>
    </div>
  );
};

// Tab component
export const Tabs = ({ tabs, defaultTab = 0, onChange }) => {
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  const handleTabChange = (index) => {
    setActiveTab(index);
    onChange?.(index);
  };

  return (
    <div>
      <div className="flex gap-4 border-b border-slate-700">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === index
              ? 'border-brand-400 text-brand-300'
              : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{tabs[activeTab].content}</div>
    </div>
  );
};

// Toggle switch component
export const Toggle = ({ checked, onChange, label, disabled = false }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-slate-700'}`} />
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </div>
    {label && <span className="text-slate-200">{label}</span>}
  </label>
);
