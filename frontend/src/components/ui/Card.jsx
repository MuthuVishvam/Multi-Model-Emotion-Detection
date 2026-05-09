export function Card({ className = "", children, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }) {
  return (
    <div className={`px-5 py-4 border-b border-slate-100/60 flex flex-col gap-1 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children }) {
  return (
    <h3 className={`text-base font-semibold text-slate-900 tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children }) {
  return (
    <p className={`text-sm text-slate-500 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children }) {
  return (
    <div className={`p-5 ${className}`}>
      {children}
    </div>
  );
}
