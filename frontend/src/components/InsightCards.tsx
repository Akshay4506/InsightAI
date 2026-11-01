/** Up to three insight cards, each with an icon and staggered entrance. */
import { motion } from "framer-motion";
import { BarChart3, Lightbulb, TrendingUp } from "lucide-react";

const ICONS = [Lightbulb, TrendingUp, BarChart3];

export default function InsightCards({ insights }: { insights: string[] }) {
  if (!insights.length) return null;
  return (
    <div className={`grid gap-3 ${insights.length >= 3 ? "md:grid-cols-3" : insights.length === 2 ? "md:grid-cols-2" : ""}`}>
      {insights.map((text, i) => {
        const Icon = ICONS[i % ICONS.length];
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i + 0.2 }}
            className="lift min-w-0 rounded-xl border border-ink/[0.06] bg-ink/[0.03] p-4">
            <div className="gradient-bg mb-3 flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-accent/20">
              <Icon size={16} className="text-white" />
            </div>
            <p className="text-sm leading-relaxed text-fg [overflow-wrap:anywhere]">{text}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
