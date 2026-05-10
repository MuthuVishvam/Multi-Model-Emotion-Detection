import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const OPTIONS = [
  { value: "line", label: "Line Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "donut", label: "Donut Chart" },
  { value: "heatmap", label: "Heatmap" },
  { value: "area", label: "Area Chart" },
];

function MiniPreview({ type }) {
  if (type === "bar") {
    return (
      <svg viewBox="0 0 36 24" className="h-6 w-9" aria-hidden="true">
        <rect x="4" y="12" width="4" height="8" rx="1" fill="#38bdf8" />
        <rect x="13" y="7" width="4" height="13" rx="1" fill="#60a5fa" />
        <rect x="22" y="4" width="4" height="16" rx="1" fill="#22d3ee" />
        <rect x="31" y="10" width="3" height="10" rx="1" fill="#818cf8" />
      </svg>
    );
  }

  if (type === "donut") {
    return (
      <svg viewBox="0 0 36 24" className="h-6 w-9" aria-hidden="true">
        <circle cx="18" cy="12" r="8" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="22 32" />
        <circle cx="18" cy="12" r="8" fill="none" stroke="#818cf8" strokeWidth="4" strokeDasharray="13 32" strokeDashoffset="-22" />
        <circle cx="18" cy="12" r="8" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray="10 32" strokeDashoffset="-35" />
      </svg>
    );
  }

  if (type === "heatmap") {
    return (
      <svg viewBox="0 0 36 24" className="h-6 w-9" aria-hidden="true">
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={4 + col * 7}
              y={4 + row * 6}
              width="5"
              height="4"
              rx="1"
              fill={["#0ea5e9", "#22d3ee", "#2563eb", "#14b8a6"][(row + col) % 4]}
              opacity={0.45 + ((row + col) % 3) * 0.2}
            />
          )),
        )}
      </svg>
    );
  }

  if (type === "area") {
    return (
      <svg viewBox="0 0 36 24" className="h-6 w-9" aria-hidden="true">
        <path d="M4 19 L4 15 L11 11 L18 13 L25 6 L32 9 L32 19 Z" fill="#0ea5e9" opacity="0.38" />
        <path d="M4 15 L11 11 L18 13 L25 6 L32 9" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 36 24" className="h-6 w-9" aria-hidden="true">
      <path d="M4 17 L11 12 L17 14 L24 7 L32 10" fill="none" stroke="#67e8f9" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="12" r="2" fill="#38bdf8" />
      <circle cx="24" cy="7" r="2" fill="#818cf8" />
    </svg>
  );
}

export default function ChartSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = OPTIONS.find((option) => option.value === value) || OPTIONS[0];

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[8px] border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-bold text-slate-100 shadow-none hover:border-cyan-400/50 hover:bg-slate-900/80 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <MiniPreview type={selected.value} />
          <span className="truncate">{selected.label.replace(" Chart", "")}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-56 rounded-[8px] border border-cyan-400/20 bg-slate-950/90 p-1.5 shadow-2xl shadow-slate-950/50 backdrop-blur-xl"
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {OPTIONS.map((option) => {
              const active = option.value === selected.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-bold transition ${
                    active
                      ? "bg-cyan-400/15 text-cyan-100"
                      : "text-slate-300 hover:bg-slate-800/90 hover:text-slate-50"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="rounded-[8px] border border-slate-700/70 bg-slate-900/80 px-1">
                    <MiniPreview type={option.value} />
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
