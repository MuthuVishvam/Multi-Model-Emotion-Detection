import { motion } from "framer-motion";

export default function DashboardLayout({ children }) {
  return (
    <motion.div
      className="relative w-full min-w-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-[8px] bg-gradient-to-b from-blue-500/10 to-transparent" />
      <main className="relative z-0 min-w-0">{children}</main>
    </motion.div>
  );
}
