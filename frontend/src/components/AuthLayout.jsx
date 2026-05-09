import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function AuthLayout({ heroLabel, heroTitle, heroDescription, heroFeatures, children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans relative overflow-hidden text-slate-200">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-600/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[150px] pointer-events-none" />

      {/* Top Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-12 bg-slate-900/40 backdrop-blur-md border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(59,130,246,0.4)]">
            M
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tight">
            MELD AI
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className={`text-sm font-semibold transition-colors ${
              isLogin ? "text-brand-400" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className={`text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 ${
              !isLogin
                ? "bg-brand-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:bg-brand-500"
                : "bg-slate-800 text-slate-300 shadow-sm border border-slate-700 hover:bg-slate-700"
            }`}
          >
            Create Account
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row relative z-10 w-full max-w-[1600px] mx-auto">
        {/* Left Hero Section */}
        <section className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 lg:p-24 relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-xl"
          >
            <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-brand-500/10 border border-brand-500/20 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              <span className="text-xs font-bold text-brand-400 tracking-wider uppercase">
                {heroLabel}
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
              {heroTitle}
            </h1>
            <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg">
              {heroDescription}
            </p>

            <ul className="space-y-5">
              {heroFeatures.map((feature, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1, duration: 0.5 }}
                  className="flex items-center gap-4 text-slate-300 font-medium text-lg"
                >
                  <div className="bg-brand-500/20 p-1 rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-brand-400 shrink-0" />
                  </div>
                  <span>{feature}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </section>

        {/* Right Form Section */}
        <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="w-full max-w-md relative"
          >
            {/* Glassmorphism Card */}
            <div className="relative z-10 glass-panel rounded-3xl p-8 sm:p-10">
              {children}
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
