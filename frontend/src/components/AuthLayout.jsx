import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function AuthLayout({ heroLabel, heroTitle, heroDescription, heroFeatures, children }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-400/20 blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12 bg-white/50 backdrop-blur-md border-b border-white/20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            M
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className={`text-sm font-medium transition-colors ${
              isLogin ? "text-blue-700" : "text-slate-600 hover:text-blue-600"
            }`}
          >
            Login
          </Link>
          <Link
            to="/register"
            className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${
              !isLogin
                ? "bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg"
                : "bg-white text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Register
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
            <div className="inline-block px-3 py-1 mb-6 rounded-full bg-blue-100/80 border border-blue-200 backdrop-blur-sm shadow-sm">
              <span className="text-xs font-bold text-blue-700 tracking-wider uppercase">
                {heroLabel}
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              {heroTitle}
            </h1>
            <p className="text-lg text-slate-600 mb-10 leading-relaxed">
              {heroDescription}
            </p>

            <ul className="space-y-4">
              {heroFeatures.map((feature, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3 text-slate-700 font-medium"
                >
                  <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>{feature}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Decorative shapes behind text */}
          <div className="absolute top-[20%] right-[10%] w-64 h-64 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[10%] left-[20%] w-72 h-72 bg-cyan-300/30 rounded-full blur-3xl pointer-events-none" />
        </section>

        {/* Right Form Section */}
        <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="w-full max-w-md relative"
          >
            {/* Glassmorphism Card */}
            <div className="relative z-10 bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-8 sm:p-10 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              {children}
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
