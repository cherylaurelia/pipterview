"use client";

import { Excalidraw, convertToExcalidrawElements, exportToBlob, getSceneVersion } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import type { WorkspaceHandle } from "./handle";


/** One click adds a labeled box; draw arrows between boxes with Excalidraw's arrow tool. */
const COMPONENTS: { label: string; color: string; shape?: "rectangle" | "ellipse" | "diamond" }[] = [
  { label: "Client", color: "#a5d8ff" },
  { label: "CDN", color: "#d0bfff" },
  { label: "Load balancer", color: "#ffd8a8", shape: "diamond" },
  { label: "API server", color: "#b2f2bb" },
  { label: "Worker", color: "#b2f2bb" },
  { label: "Cache", color: "#ffec99" },
  { label: "Database", color: "#ffc9c9", shape: "ellipse" },
  { label: "Queue", color: "#e9ecef" },
  { label: "Object storage", color: "#c3fae8" },
];

const NOTES_TEMPLATE = `Requirements
-

Scale estimates
-

APIs
-

Data model
-
`;

/** Turns the drawing into text the interviewer can reason about precisely. */
function describeDiagram(elements: readonly ExcalidrawElement[]): string {
  const live = elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const textIn = (container: ExcalidrawElement) => {
    const text = live.find((e) => e.type === "text" && e.containerId === container.id);
    return text && text.type === "text" ? text.text.replace(/\s+/g, " ").trim() : "";
  };
  const name = (e: ExcalidrawElement) => textIn(e) || `unlabeled ${e.type}`;

  const shapes = live.filter((e) => e.type === "rectangle" || e.type === "ellipse" || e.type === "diamond");
  const arrows = live.flatMap((e) => (e.type === "arrow" ? [e] : []));
  const freeText = live.flatMap((e) => (e.type === "text" && !e.containerId ? [e.text.replace(/\s+/g, " ").trim()] : []));
  const sketches = live.filter((e) => e.type === "freedraw").length;

  const lines: string[] = [];
  lines.push(shapes.length ? `Components: ${shapes.map(name).join("; ")}` : "Components: none yet");
  if (arrows.length) {
    const ends = (id?: string) => {
      const target = id ? byId.get(id) : undefined;
      return target ? name(target) : "(not connected)";
    };
    lines.push(
      `Connections: ${arrows
        .map((a) => {
          const label = textIn(a);
          return `${ends(a.startBinding?.elementId)} -> ${ends(a.endBinding?.elementId)}${label ? ` (${label})` : ""}`;
        })
        .join("; ")}`,
    );
  }
  if (freeText.length) lines.push(`Other text on the board: ${freeText.join(" | ")}`);
  if (sketches) lines.push(`Freehand strokes: ${sketches}`);
  return lines.join("\n");
}

async function blobToBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Whiteboard for the system design round: Excalidraw with a component
 * palette, plus notes for requirements, estimates, APIs, and the data model.
 */
export default function DesignWorkspace({
  active,
  ref,
  onActivity,
}: {
  active: boolean;
  ref?: Ref<WorkspaceHandle>;
  /** Called when the drawing or notes change, so hands-free voice doesn't send mid-sketch. */
  onActivity?: () => void;
}) {
  const sceneVersion = useRef(0);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const [notes, setNotes] = useState(NOTES_TEMPLATE);
  const [showNotes, setShowNotes] = useState(true);
  const added = useRef(0);
  const notesRef = useRef(notes);

  const addComponent = (component: (typeof COMPONENTS)[number]) => {
    const excalidraw = api.current;
    if (!excalidraw) return;
    const { scrollX, scrollY, zoom, width, height } = excalidraw.getAppState();
    // Stagger new boxes around the middle of the visible canvas.
    const n = added.current++;
    const x = -scrollX + width / 2 / zoom.value - 80 + ((n % 4) - 1.5) * 190;
    const y = -scrollY + height / 2 / zoom.value - 40 + (Math.floor(n / 4) % 3) * 110 - 110;
    const [shape, ...rest] = convertToExcalidrawElements([
      {
        type: component.shape ?? "rectangle",
        x,
        y,
        width: 160,
        height: 70,
        backgroundColor: component.color,
        fillStyle: "solid",
        roundness: component.shape ? null : { type: 3 },
        label: { text: component.label, fontSize: 18 },
      },
    ]);
    excalidraw.updateScene({ elements: [...excalidraw.getSceneElements(), shape, ...rest] });
  };

  useImperativeHandle(
    ref,
    () => {
      const snapshot = async () => {
        const excalidraw = api.current;
        const elements = excalidraw?.getSceneElements() ?? [];
        const notesText = notesRef.current.trim() === NOTES_TEMPLATE.trim() ? "" : notesRef.current.trim();
        if (!excalidraw || (elements.length === 0 && !notesText)) return null;

        let image: string | undefined;
        if (elements.length > 0) {
          const blob = await exportToBlob({
            elements,
            files: excalidraw.getFiles(),
            appState: { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false },
            mimeType: "image/jpeg",
            quality: 0.8,
            maxWidthOrHeight: 1400,
            exportPadding: 24,
          });
          image = await blobToBase64(blob);
        }
        const diagram = describeDiagram(elements);
        return {
          snapshot: { kind: "design" as const, notes: notesText, diagram, image },
          key: `${getSceneVersion(elements)}:${notesText}`,
        };
      };
      return {
        snapshot,
        async finalWork() {
          const current = await snapshot();
          return current ? [current.snapshot] : [];
        },
      };
    },
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-800" data-workspace>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2.5">
        <span className="mr-1 text-xs font-medium text-slate-500">Add</span>
        {COMPONENTS.map((c) => (
          <button
            key={c.label}
            onClick={() => addComponent(c)}
            disabled={!active}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-800 ring-1 ring-black/5 hover:brightness-95 disabled:opacity-40"
            style={{ backgroundColor: c.color }}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-slate-400 xl:inline">Connect boxes with the arrow tool (A)</span>
      </div>

      <div className="relative min-h-[280px] flex-1">
        <div className="absolute inset-0">
          <Excalidraw
            excalidrawAPI={(instance) => {
              api.current = instance;
            }}
            onChange={(elements) => {
              const version = getSceneVersion(elements);
              if (version !== sceneVersion.current) {
                sceneVersion.current = version;
                onActivity?.();
              }
            }}
            theme="light"
            viewModeEnabled={!active}
            UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
          />
        </div>
        {!active && (
          <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200">
              The whiteboard unlocks when the interview starts
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70">
        <button
          onClick={() => setShowNotes((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-2.5 text-left text-xs text-slate-500 hover:text-slate-900"
        >
          <span className="font-medium uppercase tracking-wide">Notes: requirements, estimates, APIs, data model</span>
          <span>{showNotes ? "Hide" : "Show"}</span>
        </button>
        {showNotes && (
          <textarea
            value={notes}
            onChange={(e) => {
              onActivity?.();
              notesRef.current = e.target.value;
              setNotes(e.target.value);
            }}
            disabled={!active}
            rows={7}
            className="block w-full resize-y bg-transparent px-5 pb-4 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none disabled:opacity-50"
          />
        )}
      </div>
    </div>
  );
}
