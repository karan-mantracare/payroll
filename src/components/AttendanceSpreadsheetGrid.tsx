"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Clipboard, Table as TableIcon, FileText, Eraser } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  placeholder?: string;
  width?: string;
}

interface AttendanceSpreadsheetGridProps {
  machine: "PV" | "STANDARD";
  value: string;
  onChange: (newValue: string) => void;
}

const PV_COLUMNS: ColumnDef[] = [
  { key: "employeeCode", label: "Employee Code", placeholder: "EMP-001", width: "w-1/4" },
  { key: "timestamp", label: "Time Stamp", placeholder: "2026-11-01 09:05:00", width: "w-1/2" },
  { key: "timeZone", label: "Time Zone", placeholder: "Asia/Kolkata", width: "w-1/4" },
];

const STANDARD_COLUMNS: ColumnDef[] = [
  { key: "employeeCode", label: "Employee Code", placeholder: "EMP-001", width: "w-1/6" },
  { key: "date", label: "Date", placeholder: "2026-11-01", width: "w-1/6" },
  { key: "checkIn", label: "Check-In", placeholder: "09:00", width: "w-1/6" },
  { key: "checkOut", label: "Check-Out", placeholder: "18:00", width: "w-1/6" },
  { key: "status", label: "Status", placeholder: "PRESENT", width: "w-1/6" },
  { key: "notes", label: "Notes", placeholder: "Schedule", width: "w-1/6" },
];

export default function AttendanceSpreadsheetGrid({
  machine,
  value,
  onChange,
}: AttendanceSpreadsheetGridProps) {
  const columns = machine === "PV" ? PV_COLUMNS : STANDARD_COLUMNS;
  const [viewMode, setViewMode] = useState<"grid" | "raw">("grid");
  const [rows, setRows] = useState<string[][]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Parse raw text into 2D string array for grid
  const parseRawToGrid = (rawText: string, currentMachine: "PV" | "STANDARD"): string[][] => {
    if (!rawText.trim()) return [Array(columns.length).fill("")];

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const result: string[][] = [];

    for (const line of lines) {
      let parts: string[] = [];
      if (line.includes(" - ")) {
        parts = line.split(" - ").map((p) => p.trim());
      } else if (line.includes("\t")) {
        parts = line.split("\t").map((p) => p.trim());
      } else if (line.includes(",")) {
        parts = line.split(",").map((p) => p.trim());
      } else if (line.includes(";")) {
        parts = line.split(";").map((p) => p.trim());
      } else {
        parts = [line];
      }

      // Skip header lines
      const first = (parts[0] || "").toLowerCase();
      if (
        first.includes("employee") ||
        first.includes("emp code") ||
        (parts[1] && parts[1].toLowerCase().includes("time"))
      ) {
        continue;
      }

      const rowCols = Array(columns.length).fill("");
      for (let c = 0; c < columns.length; c++) {
        rowCols[c] = parts[c] || "";
      }
      result.push(rowCols);
    }

    return result.length > 0 ? result : [Array(columns.length).fill("")];
  };

  // Convert 2D string array back to raw text for submission
  const convertGridToRaw = (gridRows: string[][], currentMachine: "PV" | "STANDARD"): string => {
    const validRows = gridRows.filter((r) => r.some((c) => c.trim().length > 0));
    if (validRows.length === 0) return "";

    if (currentMachine === "PV") {
      const header = "Employee Code - Time Stamp - Time Zone";
      const body = validRows
        .map((r) => {
          const code = (r[0] || "").trim();
          const time = (r[1] || "").trim();
          const tz = (r[2] || "").trim() || "Asia/Kolkata";
          return `${code} - ${time} - ${tz}`;
        })
        .join("\n");
      return `${header}\n${body}`;
    } else {
      const header = "EmployeeCode,Date,CheckIn,CheckOut,Status,Notes";
      const body = validRows
        .map((r) => {
          const code = (r[0] || "").trim();
          const date = (r[1] || "").trim();
          const inTime = (r[2] || "").trim();
          const outTime = (r[3] || "").trim();
          const status = (r[4] || "").trim() || "PRESENT";
          const notes = (r[5] || "").trim();
          return `${code},${date},${inTime},${outTime},${status},${notes}`;
        })
        .join("\n");
      return `${header}\n${body}`;
    }
  };

  // Sync incoming value to internal grid state
  useEffect(() => {
    const parsed = parseRawToGrid(value, machine);
    setRows(parsed);
  }, [value, machine]);

  // Handle cell edit
  const handleCellChange = (rowIndex: number, colIndex: number, text: string) => {
    const next = rows.map((r, rIdx) => {
      if (rIdx !== rowIndex) return r;
      const copy = [...r];
      copy[colIndex] = text;
      return copy;
    });
    setRows(next);
    onChange(convertGridToRaw(next, machine));
  };

  // Add new row
  const handleAddRow = () => {
    const newRow = Array(columns.length).fill("");
    const next = [...rows, newRow];
    setRows(next);
    onChange(convertGridToRaw(next, machine));
    setActiveCell({ row: next.length - 1, col: 0 });
  };

  // Remove row
  const handleRemoveRow = (rowIndex: number) => {
    if (rows.length <= 1) {
      const empty = [Array(columns.length).fill("")];
      setRows(empty);
      onChange("");
      return;
    }
    const next = rows.filter((_, idx) => idx !== rowIndex);
    setRows(next);
    onChange(convertGridToRaw(next, machine));
  };

  // Clear all data
  const handleClear = () => {
    const empty = [
      Array(columns.length).fill(""),
      Array(columns.length).fill(""),
      Array(columns.length).fill(""),
    ];
    setRows(empty);
    onChange("");
  };

  // Paste handler for Excel / Google Sheets tabular data
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    if (!pasteData) return;

    const lines = pasteData
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    // Parse paste rows (split by tab or hyphen or comma)
    const pasteMatrix: string[][] = [];
    for (const line of lines) {
      let parts: string[] = [];
      if (line.includes("\t")) {
        parts = line.split("\t").map((p) => p.trim());
      } else if (line.includes(" - ")) {
        parts = line.split(" - ").map((p) => p.trim());
      } else if (line.includes(",")) {
        parts = line.split(",").map((p) => p.trim());
      } else {
        parts = [line];
      }

      // Skip header if pasted
      const first = (parts[0] || "").toLowerCase();
      if (
        first.includes("employee") ||
        first.includes("emp code") ||
        (parts[1] && parts[1].toLowerCase().includes("time"))
      ) {
        continue;
      }
      pasteMatrix.push(parts);
    }

    if (pasteMatrix.length === 0) return;

    // Deep copy current rows
    const next = rows.map((r) => [...r]);

    // Ensure we have enough rows
    const neededRows = startRow + pasteMatrix.length;
    while (next.length < neededRows) {
      next.push(Array(columns.length).fill(""));
    }

    // Apply paste matrix
    for (let r = 0; r < pasteMatrix.length; r++) {
      const targetRow = startRow + r;
      for (let c = 0; c < pasteMatrix[r].length; c++) {
        const targetCol = startCol + c;
        if (targetCol < columns.length) {
          next[targetRow][targetCol] = pasteMatrix[r][c];
        }
      }
    }

    setRows(next);
    onChange(convertGridToRaw(next, machine));
  };

  // Paste from system clipboard via button
  const handleClipboardPasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const pasteMatrix: string[][] = [];

      for (const line of lines) {
        let parts: string[] = [];
        if (line.includes("\t")) {
          parts = line.split("\t").map((p) => p.trim());
        } else if (line.includes(" - ")) {
          parts = line.split(" - ").map((p) => p.trim());
        } else if (line.includes(",")) {
          parts = line.split(",").map((p) => p.trim());
        } else {
          parts = [line];
        }

        const first = (parts[0] || "").toLowerCase();
        if (first.includes("employee") || (parts[1] && parts[1].toLowerCase().includes("time"))) {
          continue;
        }
        pasteMatrix.push(parts);
      }

      if (pasteMatrix.length === 0) return;

      const formattedRows = pasteMatrix.map((parts) => {
        const row = Array(columns.length).fill("");
        for (let c = 0; c < columns.length; c++) {
          row[c] = parts[c] || "";
        }
        return row;
      });

      setRows(formattedRows);
      onChange(convertGridToRaw(formattedRows, machine));
    } catch {
      // Clipboard access denied or unsupported; user can paste directly into cells with Ctrl+V
    }
  };

  return (
    <div className="space-y-2">
      {/* Grid Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {machine === "PV" ? "Punch Spreadsheet Grid" : "Attendance Spreadsheet Grid"}
          </span>
          <span className="text-[11px] text-slate-400">
            ({rows.filter((r) => r.some((c) => c.trim().length > 0)).length} rows)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "grid" && (
            <>
              <button
                type="button"
                onClick={handleClipboardPasteButton}
                title="Paste tabular data from Excel or clipboard"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste from Excel</span>
              </button>

              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                title="Clear all rows"
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-medium transition"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setViewMode(viewMode === "grid" ? "raw" : "grid")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium transition"
          >
            {viewMode === "grid" ? (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>Raw Text</span>
              </>
            ) : (
              <>
                <TableIcon className="w-3.5 h-3.5" />
                <span>Spreadsheet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewMode === "raw" ? (
        <textarea
          rows={7}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full font-mono text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
          placeholder="Paste comma or hyphen-separated data here..."
        />
      ) : (
        <div
          ref={tableRef}
          className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-xs"
        >
          {/* Scrollable spreadsheet container */}
          <div className="max-h-64 overflow-y-auto overflow-x-auto select-none">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-10 px-2 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-xs border-r border-slate-200 dark:border-slate-700 ${col.width || ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="w-10 px-2 py-2 text-center text-[10px] font-bold text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Row Index */}
                    <td className="px-2 py-1.5 text-center text-[10px] text-slate-400 font-sans border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 select-none">
                      {rIdx + 1}
                    </td>

                    {/* Cells */}
                    {columns.map((col, cIdx) => (
                      <td
                        key={col.key}
                        className={`p-0 border-r border-slate-100 dark:border-slate-800 ${
                          activeCell?.row === rIdx && activeCell?.col === cIdx
                            ? "ring-2 ring-[#36B4FF] z-10"
                            : ""
                        }`}
                      >
                        <input
                          type="text"
                          value={row[cIdx] || ""}
                          placeholder={col.placeholder}
                          onFocus={() => setActiveCell({ row: rIdx, col: cIdx })}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                          className="w-full h-full px-2.5 py-1.5 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none"
                        />
                      </td>
                    ))}

                    {/* Delete Action */}
                    <td className="px-1.5 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(rIdx)}
                        title="Delete row"
                        className="p-1 text-slate-300 hover:text-red-500 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Tip: Click any cell and press <strong>Ctrl+V</strong> to paste multi-row columns directly from Excel or Google Sheets.
            </span>
            <button
              type="button"
              onClick={handleAddRow}
              className="text-[#293381] dark:text-[#36B4FF] font-semibold hover:underline"
            >
              + Add Row
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
