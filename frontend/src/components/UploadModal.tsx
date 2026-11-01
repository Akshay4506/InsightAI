/** Modal to upload a CSV/XLSX dataset (drag & drop or file picker). */
import { AnimatePresence, motion } from "framer-motion";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

const ACCEPT = ".csv,.tsv,.xlsx,.xlsm";

export default function UploadModal({ open, onClose, onUpload }: {
  open: boolean; onClose: () => void; onUpload: (f: File) => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  const close = () => { if (!busy) { setError(null); setName(null); onClose(); } };

  const handle = async (file?: File) => {
    if (!file) return;
    setName(file.name);
    setError(null);
    if (!/\.(csv|tsv|xlsx|xlsm)$/i.test(file.name)) return setError("Upload a .csv or .xlsx file");
    setBusy(true);
    try {
      await onUpload(file);
      setName(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div role="dialog" aria-label="Upload dataset" initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
            onMouseDown={(e) => e.stopPropagation()} className="glass !bg-card w-full max-w-lg rounded-3xl p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">Upload a dataset</h2>
                <p className="text-sm text-muted">CSV or Excel, up to 25 MB. Each Excel sheet becomes a table.</p>
              </div>
              <button onClick={close} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-ink/10 hover:text-fg"><X size={18} /></button>
            </div>

            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files[0]); }}
              onClick={() => !busy && input.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-accent bg-accent/10" : "border-ink/20 hover:border-accent/60 hover:bg-ink/[0.03]"}`}>
              {busy ? <Loader2 size={34} className="animate-spin text-accent" /> : name ? <FileSpreadsheet size={34} className="text-accent" /> : <UploadCloud size={34} className="text-accent" />}
              <div className="text-sm text-fg">
                {busy ? `Processing ${name}...` : <>Drag a file here or <span className="gradient-text font-semibold">browse</span></>}
              </div>
              <div className="text-xs text-faint">.csv  .xlsx</div>
              <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
