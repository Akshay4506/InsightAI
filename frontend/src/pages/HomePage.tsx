/** Public landing page: hero, features, how-it-works, CTA. */
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Brain, FileSpreadsheet, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { icon: MessageSquareText, title: "Ask in plain English", text: "No SQL needed. Type a question and get a precise answer from your data." },
  { icon: FileSpreadsheet, title: "Bring your own data", text: "Upload a CSV or Excel file and chat with it instantly. Every conversation remembers its file." },
  { icon: ShieldCheck, title: "Safe by design", text: "Every generated query is validated and run read-only. Nothing can modify or leak your data." },
  { icon: BarChart3, title: "Charts that pick themselves", text: "Bar, line, pie, scatter or KPI cards chosen automatically from the shape of your result." },
  { icon: Sparkles, title: "Insights and follow-ups", text: "Plain-language takeaways and suggested next questions with every answer." },
  { icon: Brain, title: "See the agent think", text: "A live trace shows each step of the pipeline with its latency, so every answer is auditable." },
];

const STEPS = ["Upload a dataset", "Ask a question", "We write and validate the SQL", "Get charts, insights and next steps"];

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } };

export default function HomePage() {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 text-center md:pt-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="pill inline-flex items-center gap-1.5 border border-accent/30 bg-accent/10 text-indigo-300">
              <Sparkles size={12} /> RAG + LLM + secure SQL
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-fg md:text-7xl">
              Ask your data <span className="gradient-text">anything.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
              InsightAI turns plain-English questions into validated SQL, charts and insights. Upload your own spreadsheet or explore the built-in sample store.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to={user ? "/analyze" : "/signup"}
                className="gradient-bg group flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-accent/30 transition hover:brightness-110 active:scale-95">
                {user ? "Open workspace" : "Get started free"} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              {!user && (
                <Link to="/login" className="glass lift rounded-2xl px-6 py-3.5 text-sm font-semibold text-fg active:scale-95">Log in</Link>
              )}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <motion.h2 {...fade} className="mb-10 text-center text-3xl font-bold tracking-tight text-fg">Everything an analyst does, in a chat box</motion.h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <motion.div key={title} {...fade} transition={{ duration: 0.5, delay: (i % 3) * 0.08 }} className="glass lift rounded-2xl p-6">
                <span className="gradient-bg mb-4 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-accent/25">
                  <Icon size={19} className="text-white" />
                </span>
                <h3 className="font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12">
          <motion.h2 {...fade} className="mb-10 text-center text-3xl font-bold tracking-tight text-fg">How it works</motion.h2>
          <div className="grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div key={s} {...fade} transition={{ duration: 0.5, delay: i * 0.08 }} className="glass rounded-2xl p-5">
                <div className="gradient-text text-3xl font-extrabold">0{i + 1}</div>
                <p className="mt-2 text-sm text-fg">{s}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-20 pt-8">
          <motion.div {...fade} className="gradient-bg rounded-3xl p-10 text-center shadow-2xl shadow-accent/25">
            <h2 className="text-3xl font-extrabold text-white">Ready to talk to your data?</h2>
            <p className="mx-auto mt-2 max-w-md text-white/80">Create a free account and ask your first question in under a minute.</p>
            <Link to={user ? "/analyze" : "/signup"}
              className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-white/90 active:scale-95">
              {user ? "Open workspace" : "Create account"}
            </Link>
          </motion.div>
        </section>
      </main>
      <footer className="border-t border-ink/[0.08] py-6 text-center text-xs text-faint">InsightAI - Generative AI Skill Enhancement Lab project</footer>
    </div>
  );
}
