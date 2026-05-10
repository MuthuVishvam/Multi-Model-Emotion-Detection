export function Card({ className = "", children, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`glass-card overflow-hidden transition-all duration-300 ${onClick ? "cursor-pointer hover:shadow-xl hover:border-brand-500/50 hover:-translate-y-1" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;

export function CardHeader({ className = "", children }) {
  return (
    <div className={`px-6 py-5 border-b border-slate-700/50 flex flex-col gap-1.5 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children }) {
  return (
    <h3 className={`text-lg font-semibold text-slate-100 tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children }) {
  return (
    <p className={`text-sm text-slate-400 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
