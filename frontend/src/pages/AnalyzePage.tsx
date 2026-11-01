/** Workspace: [sidebar | dataset bar + chat | agent trace] under the navbar. Responsive: sidebar slides over, trace becomes a tab. */
import { AnimatePresence, motion } from "framer-motion";
import { Brain, CheckCircle2, Loader2, MessageSquare, PanelLeft, Upload, WifiOff } from "lucide-react";
import { useState } from "react";
import ChatPanel from "../components/ChatPanel";
import DatasetPicker from "../components/DatasetPicker";
import Navbar from "../components/Navbar";
import SchemaDropdown from "../components/SchemaDropdown";
import Sidebar from "../components/Sidebar";
import PanelEdge from "../components/PanelEdge";
import TracePanel from "../components/TracePanel";
import UploadModal from "../components/UploadModal";
import { useChatContext } from "../context/ChatContext";
import { PANEL_MAX, PANEL_MIN, usePanel } from "../hooks/usePanel";

export default function AnalyzePage() {
  const chat = useChatContext();
  const left = usePanel("insightai-left");
  const right = usePanel("insightai-right");
  // Keep at least ~380px for the chat column while dragging.
  const maxFor = (otherCollapsed: boolean, otherWidth: number) =>
    Math.max(PANEL_MIN, Math.min(PANEL_MAX, window.innerWidth - (otherCollapsed ? 40 : otherWidth) - 380));

  const [input, setInput] = useState("");
  const [tab, setTab] = useState<"chat" | "trace">("chat");
  const [sidebar, setSidebar] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const ask = (q: string) => { setTab("chat"); void chat.ask(q); };
  const hasData = chat.datasets.length > 0;
  const datasetName = chat.readOnly && chat.conversationDataset ? chat.conversationDataset.name : chat.activeName;
  const sidebarEl = (
    <Sidebar history={chat.history} activeConversation={chat.conversationId} pendingIds={chat.pendingIds}
      onNew={() => { chat.newChat(); setSidebar(false); }}
      onOpen={(id) => { void chat.openConversation(id); setSidebar(false); setTab("chat"); }}
      onDelete={chat.deleteConversation} onRename={chat.renameConversation} onClearHistory={chat.clearHistory} />
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Navbar />

      <div className="flex shrink-0 border-b border-ink/[0.06] lg:hidden">
        {([["chat", MessageSquare, "Chat"], ["trace", Brain, "Agent Brain"]] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm ${tab === k ? "gradient-text font-semibold" : "text-faint"}`}>
            <Icon size={15} className={tab === k ? "text-accent2" : ""} /> {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className={`relative hidden min-h-0 lg:flex ${left.collapsed ? "lg:w-0" : "lg:w-[var(--pw)]"}`} style={{ "--pw": `${left.width}px` } as React.CSSProperties}>
          <div className={`flex min-h-0 w-full ${left.collapsed ? "lg:hidden" : ""}`}>{sidebarEl}</div>
          <PanelEdge side="left" collapsed={left.collapsed} onToggle={left.toggle} onReset={left.reset}
            onResize={(w) => left.setWidth(w, maxFor(right.collapsed, right.width))} />
        </div>

        <AnimatePresence>
          {sidebar && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebar(false)}>
              <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="h-full w-72 max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
                <div className="h-full [&>aside]:!bg-card">{sidebarEl}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className={`min-h-0 min-w-0 flex-1 flex-col ${tab === "chat" ? "flex" : "hidden"} lg:flex`}>
          <div className="flex shrink-0 items-center gap-2 border-b border-ink/[0.06] px-4 py-3 md:px-8">
            <button onClick={() => setSidebar(true)} aria-label="Open history" className="glass rounded-xl p-2.5 text-muted lg:hidden"><PanelLeft size={16} /></button>
            {hasData && (
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
                <DatasetPicker datasets={chat.datasets} activeId={chat.activeId} multi={chat.multi} multiIds={chat.multiIds}
                  label={chat.readOnly ? `${datasetName} (removed)` : undefined}
                  onSelect={chat.selectDataset} onSelectMulti={chat.selectMulti} onUpload={() => setUploadOpen(true)} onDelete={chat.removeDataset} onRename={chat.renameDataset} disabled={chat.loading} />
                <div className="flex min-w-0 justify-center">
                  {!chat.readOnly && <SchemaDropdown datasets={chat.inUse} disabled={chat.loading} />}
                </div>
                <button onClick={() => setUploadOpen(true)} disabled={chat.loading}
                  title={chat.loading ? "Wait for the current answer to finish" : undefined}
                  className="glass lift flex w-full min-w-0 max-w-[13rem] items-center justify-center gap-2 justify-self-end whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-fg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
                  <Upload size={15} className="shrink-0 text-accent" /> <span className="truncate">Upload data</span>
                </button>
              </div>
            )}
          </div>
          {!chat.ready ? (
            <div className="flex flex-1 items-center justify-center text-faint"><Loader2 className="animate-spin" /></div>
          ) : !hasData && !chat.readOnly ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 text-center">
              <h1 className="gradient-text text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Upload your data to begin.</h1>
              <p className="mt-4 max-w-md text-muted">Add a CSV or Excel file and ask questions about it in plain English. Suggested questions are generated from your data.</p>
              <button onClick={() => setUploadOpen(true)}
                className="gradient-bg lift mt-8 flex items-center gap-2.5 rounded-2xl px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/30 active:scale-95">
                <Upload size={18} /> Upload dataset
              </button>
              <p className="mt-3 text-xs text-faint">.csv or .xlsx, up to 25 MB</p>
            </motion.div>
          ) : (
            <ChatPanel messages={chat.messages} loading={chat.loading} input={input} setInput={setInput} onSend={ask} onStop={chat.stop} onEdit={(i, t) => { setTab("chat"); void chat.edit(i, t); }}
              suggestions={chat.suggestions} datasetName={datasetName} readOnly={chat.readOnly} />
          )}
        </main>

        <div className={`relative min-h-0 ${tab === "trace" ? "flex flex-1" : "hidden"} lg:flex lg:flex-none ${right.collapsed ? "lg:w-0" : "lg:w-[var(--pw)]"}`}
          style={{ "--pw": `${right.width}px` } as React.CSSProperties}>
          <div className={`flex min-h-0 w-full ${right.collapsed ? "lg:hidden" : ""}`}>
            <TracePanel result={chat.lastResult} loading={chat.loading} />
          </div>
          <PanelEdge side="right" collapsed={right.collapsed} onToggle={right.toggle} onReset={right.reset}
            onResize={(w) => right.setWidth(w, maxFor(left.collapsed, left.width))} />
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={chat.upload} />

      <AnimatePresence>
        {chat.toast && (
          <motion.button style={{ x: "-50%" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={chat.dismissToast}
            className={`fixed bottom-24 left-1/2 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl ${chat.toast.tone === "ok"
              ? "border-emerald-500/30 bg-card text-emerald-300" : "border-red-500/30 bg-card text-red-300"}`}>
            {chat.toast.tone === "ok" ? <CheckCircle2 size={16} /> : <WifiOff size={16} />} {chat.toast.text}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
