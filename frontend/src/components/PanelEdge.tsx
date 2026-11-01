/** Inner edge of a side panel: drag to resize, double-click to reset, button to collapse / expand.
 *  Must be placed inside a `relative` wrapper that has the panel's width. Desktop (lg+) only. */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

interface Props {
  side: "left" | "right";
  collapsed: boolean;
  onToggle: () => void;
  onResize: (width: number) => void;
  onReset: () => void;
}

export default function PanelEdge({ side, collapsed, onToggle, onResize, onReset }: Props) {
  const handle = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const left = side === "left";

  const move = (e: React.PointerEvent) => {
    if (!dragging) return;
    const rect = handle.current?.parentElement?.getBoundingClientRect();
    if (rect) onResize(left ? e.clientX - rect.left : rect.right - e.clientX);
  };

  // Chevron points where the panel will go: left panel expanded -> "<" (collapse), collapsed -> ">" (expand).
  const Icon = left === !collapsed ? ChevronLeft : ChevronRight;
  const btn = `absolute top-4 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-ink/15 bg-card text-muted shadow-md transition hover:border-accent/50 hover:text-accent active:scale-90 lg:flex ${
    collapsed ? (left ? "left-1" : "right-1") : left ? "-right-3" : "-left-3"}`;

  return (
    <>
      {!collapsed && (
        <div ref={handle} role="separator" aria-orientation="vertical" aria-label={`Resize ${side} panel`} title="Drag to resize, double-click to reset"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); document.body.style.userSelect = "none"; }}
          onPointerMove={move}
          onPointerUp={() => { setDragging(false); document.body.style.userSelect = ""; }}
          onPointerCancel={() => { setDragging(false); document.body.style.userSelect = ""; }}
          onDoubleClick={onReset}
          className={`group absolute top-0 z-20 hidden h-full w-2 cursor-col-resize touch-none lg:block ${left ? "-right-1" : "-left-1"}`}>
          <div className={`mx-auto h-full w-px transition-colors ${dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/60"}`} />
        </div>
      )}
      <button onClick={onToggle} className={btn} aria-label={`${collapsed ? "Expand" : "Collapse"} ${side} panel`}
        title={`${collapsed ? "Expand" : "Collapse"} ${side === "left" ? "history" : "Agent Brain"}`}>
        <Icon size={14} />
      </button>
    </>
  );
}
