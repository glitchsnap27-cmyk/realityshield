"use client";

import { motion } from "framer-motion";

export function TimelineReveal({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.4) }}
    >
      {children}
    </motion.div>
  );
}
