"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarDays,
  Calendar,
  Upload,
  Download,
  Plus,
  Edit3,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  FileText,
  Layers,
  Sparkles,
  Check,
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";

interface EmployeeQuota {
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  departmentId?: string;
  privilegeLeave: number;
  casualLeave: number;
  sickLeave: number;
  totalQuota: number;
  updatedAt?: number;
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  dayOfWeek: string;
  type: "Gazetted" | "Optional" | "Company Off";
  location: string;
  description?: string;
}

interface AdminLeaveRequest {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  absenceType: "PRIVILEGE_LEAVE" | "CASUAL_LEAVE" | "SICK_LEAVE";
  reason: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}

export default function AdminLeavesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"leave" | "holiday">("leave");

  // ==========================================
  // LEAVE QUOTAS STATE
  // ==========================================
  const [employees, setEmployees] = useState<EmployeeQuota[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [searchEmployee, setSearchEmployee] = useState("");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [dirtyQuotas, setDirtyQuotas] = useState<Record<string, { pl: number; cl: number; sl: number }>>({});
  const [savingQuotas, setSavingQuotas] = useState(false);
  const [quotaToast, setQuotaToast] = useState<string | null>(null);

  // Bulk Edit Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    privilegeLeave: 18,
    casualLeave: 12,
    sickLeave: 10,
  });

  // ==========================================
  // HOLIDAY CALENDAR STATE
  // ==========================================
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(true);
  const [holidayToast, setHolidayToast] = useState<string | null>(null);

  // Add Holiday Modal
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    type: "Gazetted" as "Gazetted" | "Optional" | "Company Off",
    location: "All Locations",
    description: "",
  });

  // Upload Holiday Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<Array<Omit<HolidayItem, "id">>>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importingHolidays, setImportingHolidays] = useState(false);

  // Leave Applications Queue State
  const [leaveRequests, setLeaveRequests] = useState<AdminLeaveRequest[]>([]);
  const [reviewingLeaveId, setReviewingLeaveId] = useState<string | null>(null);

  // ==========================================
  // FETCH DATA
  // ==========================================
  const fetchLeaveQuotas = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch("/payrol/api/leaves/quotas");
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.employees || []);
      }
    } catch {
      // fallback
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  const fetchHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const res = await fetch("/payrol/api/holidays");
      if (res.ok) {
        const json = await res.json();
        setHolidays(json.holidays || []);
      }
    } catch {
      // fallback
    } finally {
      setLoadingHolidays(false);
    }
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const res = await fetch("/payrol/api/leaves/requests?scope=all", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setLeaveRequests((json.requests || []).filter((r: AdminLeaveRequest) => r.status !== "DRAFT"));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLeaveQuotas();
    fetchHolidays();
    fetchLeaveRequests();
  }, [fetchLeaveQuotas, fetchHolidays, fetchLeaveRequests]);

  const handleReviewLeaveRequest = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setReviewingLeaveId(requestId);
    try {
      const res = await fetch("/payrol/api/leaves/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        setQuotaToast(
          action === "APPROVE"
            ? "Leave application approved."
            : "Leave application rejected."
        );
        setTimeout(() => setQuotaToast(null), 3000);
        await fetchLeaveRequests();
      }
    } catch {
      // ignore
    } finally {
      setReviewingLeaveId(null);
    }
  };

  // ==========================================
  // LEAVE ACTIONS
  // ==========================================
  const filteredEmployees = useMemo(() => {
    if (!searchEmployee.trim()) return employees;
    const q = searchEmployee.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }, [employees, searchEmployee]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmpIds(filteredEmployees.map((e) => e.employeeId));
    } else {
      setSelectedEmpIds([]);
    }
  };

  const handleSelectEmployee = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedEmpIds((prev) => [...prev, id]);
    } else {
      setSelectedEmpIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleInlineChange = (id: string, field: "pl" | "cl" | "sl", value: number) => {
    const val = Math.max(0, value);
    const emp = employees.find((e) => e.employeeId === id);
    if (!emp) return;

    setDirtyQuotas((prev) => {
      const current = prev[id] || { pl: emp.privilegeLeave, cl: emp.casualLeave, sl: emp.sickLeave };
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  const handleSaveInlineChanges = async () => {
    const updates = Object.entries(dirtyQuotas).map(([employeeId, vals]) => {
      const emp = employees.find((e) => e.employeeId === employeeId);
      return {
        employeeId,
        employeeCode: emp?.employeeCode,
        privilegeLeave: vals.pl,
        casualLeave: vals.cl,
        sickLeave: vals.sl,
      };
    });

    if (updates.length === 0) return;

    setSavingQuotas(true);
    try {
      const res = await fetch("/payrol/api/leaves/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        setDirtyQuotas({});
        setQuotaToast(`Successfully updated quotas for ${updates.length} employee(s)`);
        setTimeout(() => setQuotaToast(null), 3000);
        await fetchLeaveQuotas();
      }
    } catch {
      // ignore
    } finally {
      setSavingQuotas(false);
    }
  };

  const handleApplyBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) return;

    setSavingQuotas(true);
    try {
      const updates = selectedEmpIds.map((id) => {
        const emp = employees.find((e) => e.employeeId === id);
        return {
          employeeId: id,
          employeeCode: emp?.employeeCode,
          privilegeLeave: Number(bulkForm.privilegeLeave),
          casualLeave: Number(bulkForm.casualLeave),
          sickLeave: Number(bulkForm.sickLeave),
        };
      });

      const res = await fetch("/payrol/api/leaves/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        setShowBulkModal(false);
        setSelectedEmpIds([]);
        setQuotaToast(`Successfully applied bulk quotas to ${updates.length} employee(s)`);
        setTimeout(() => setQuotaToast(null), 3000);
        await fetchLeaveQuotas();
      }
    } catch {
      // ignore
    } finally {
      setSavingQuotas(false);
    }
  };

  // ==========================================
  // HOLIDAY ACTIONS
  // ==========================================
  const handleAddHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingHoliday(true);
    try {
      const res = await fetch("/payrol/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHoliday),
      });

      if (res.ok) {
        setShowAddHolidayModal(false);
        setNewHoliday({
          name: "",
          date: "",
          type: "Gazetted",
          location: "All Locations",
          description: "",
        });
        setHolidayToast("Holiday added to annual calendar successfully!");
        setTimeout(() => setHolidayToast(null), 3000);
        await fetchHolidays();
      }
    } catch {
      // ignore
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the holiday calendar?`)) {
      return;
    }

    try {
      const res = await fetch(`/payrol/api/holidays?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHolidayToast(`Removed "${name}" from calendar.`);
        setTimeout(() => setHolidayToast(null), 3000);
        await fetchHolidays();
      }
    } catch {
      // ignore
    }
  };

  // CSV Upload Parser
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadPreview([]);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setUploadError("CSV file must contain a header and at least one holiday row.");
          return;
        }

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const parsed: Array<Omit<HolidayItem, "id">> = [];

        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length >= 2 && cols[0] && cols[1]) {
            const name = cols[0];
            const date = cols[1];
            const type = (cols[2] as any) || "Gazetted";
            const location = cols[3] || "All Locations";
            const description = cols[4] || "";

            const dateObj = new Date(`${date}T12:00:00Z`);
            const dayOfWeek = dayNames[dateObj.getUTCDay()] || "Unknown";

            parsed.push({
              name,
              date,
              dayOfWeek,
              type: type === "Optional" ? "Optional" : "Gazetted",
              location,
              description,
            });
          }
        }

        if (parsed.length === 0) {
          setUploadError("Could not parse valid holiday rows. Ensure columns: Name, Date (YYYY-MM-DD), Type");
        } else {
          setUploadPreview(parsed);
        }
      } catch (err: any) {
        setUploadError(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmUpload = async () => {
    if (uploadPreview.length === 0) return;
    setImportingHolidays(true);
    try {
      const res = await fetch("/payrol/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidays: uploadPreview }),
      });

      if (res.ok) {
        setShowUploadModal(false);
        setUploadPreview([]);
        setHolidayToast(`Successfully imported ${uploadPreview.length} holidays!`);
        setTimeout(() => setHolidayToast(null), 3000);
        await fetchHolidays();
      }
    } catch {
      // ignore
    } finally {
      setImportingHolidays(false);
    }
  };

  const handleDownloadCSV = () => {
    const header = "Name,Date,DayOfWeek,Type,Location,Description\n";
    const rows = holidays
      .map(
        (h) =>
          `"${h.name}","${h.date}","${h.dayOfWeek}","${h.type}","${h.location}","${h.description || ""}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Annual_Holiday_Calendar_2026.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const sample = `Name,Date,Type,Location,Description\n"New Year's Day","2026-01-01","Gazetted","All Locations","New Year Celebration"\n"Makar Sankranti","2026-01-14","Optional","All Locations","Harvest Festival"`;
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Holiday_Calendar_Template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Main Option Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#293381] dark:text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#36B4FF]" />
            Leave & Holiday Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage employee annual leave quotas, statutory accruals, and company holiday calendars.
          </p>
        </div>

        {/* 2 OPTIONS TAB SWITCHER: Leave | Holiday */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("leave")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs transition ${
              activeTab === "leave"
                ? "bg-[#293381] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Leave Quotas
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === "leave" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {employees.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("holiday")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs transition ${
              activeTab === "holiday"
                ? "bg-[#293381] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Holiday Calendar
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === "holiday" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {holidays.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: LEAVE QUOTAS MANAGEMENT                            */}
      {/* ========================================================= */}
      {activeTab === "leave" && (
        <div className="space-y-5">
          {quotaToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {quotaToast}
            </div>
          )}

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
              <span className="text-xs font-semibold text-slate-500">Scoped Employees</span>
              <div className="text-2xl font-bold text-[#293381] dark:text-white mt-1">
                {employees.length}
              </div>
              <span className="text-[11px] text-slate-400">Total staff in scope</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
              <span className="text-xs font-semibold text-slate-500">Privilege Leave (PL)</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                18 <span className="text-xs font-normal text-slate-400">Days / Yr</span>
              </div>
              <span className="text-[11px] text-slate-400">Annual standard entitlement</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
              <span className="text-xs font-semibold text-slate-500">Casual Leave (CL)</span>
              <div className="text-2xl font-bold text-[#36B4FF] mt-1">
                12 <span className="text-xs font-normal text-slate-400">Days / Yr</span>
              </div>
              <span className="text-[11px] text-slate-400">Monthly accrual quota</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card">
              <span className="text-xs font-semibold text-slate-500">Sick Leave (SL)</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                10 <span className="text-xs font-normal text-slate-400">Days / Yr</span>
              </div>
              <span className="text-[11px] text-slate-400">Medical emergency quota</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employee by name, code or email..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(dirtyQuotas).length > 0 && (
                <button
                  onClick={handleSaveInlineChanges}
                  disabled={savingQuotas}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm animate-pulse"
                >
                  {savingQuotas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes ({Object.keys(dirtyQuotas).length})
                </button>
              )}

              <button
                onClick={() => {
                  if (selectedEmpIds.length === 0) {
                    setSelectedEmpIds(employees.map((e) => e.employeeId));
                  }
                  setShowBulkModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white font-semibold text-xs transition shadow-sm"
              >
                <Layers className="w-4 h-4 text-[#36B4FF]" />
                Bulk Edit Leave Quotas
                {selectedEmpIds.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
                    {selectedEmpIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Leave Quota Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-card overflow-hidden">
            {loadingEmployees ? (
              <div className="p-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading employee quota records...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No matching employee records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedEmpIds.length === filteredEmployees.length &&
                            filteredEmployees.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded text-[#293381]"
                        />
                      </th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Privilege Leave (PL)</th>
                      <th className="py-3 px-4">Casual Leave (CL)</th>
                      <th className="py-3 px-4">Sick Leave (SL)</th>
                      <th className="py-3 px-4">Total Quota</th>
                      <th className="py-3 px-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEmployees.map((emp) => {
                      const dirty = dirtyQuotas[emp.employeeId];
                      const currentPL = dirty ? dirty.pl : emp.privilegeLeave;
                      const currentCL = dirty ? dirty.cl : emp.casualLeave;
                      const currentSL = dirty ? dirty.sl : emp.sickLeave;
                      const computedTotal = currentPL + currentCL + currentSL;
                      const isSelected = selectedEmpIds.includes(emp.employeeId);

                      return (
                        <tr
                          key={emp.employeeId}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition ${
                            isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                handleSelectEmployee(emp.employeeId, e.target.checked)
                              }
                              className="rounded text-[#293381]"
                            />
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {emp.employeeCode} • {emp.email}
                            </div>
                          </td>

                          {/* Editable PL */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={currentPL}
                                onChange={(e) =>
                                  handleInlineChange(
                                    emp.employeeId,
                                    "pl",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                              />
                              <span className="text-[11px] text-slate-400">days</span>
                            </div>
                          </td>

                          {/* Editable CL */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={currentCL}
                                onChange={(e) =>
                                  handleInlineChange(
                                    emp.employeeId,
                                    "cl",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF] text-xs"
                              />
                              <span className="text-[11px] text-slate-400">days</span>
                            </div>
                          </td>

                          {/* Editable SL */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={currentSL}
                                onChange={(e) =>
                                  handleInlineChange(
                                    emp.employeeId,
                                    "sl",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                              />
                              <span className="text-[11px] text-slate-400">days</span>
                            </div>
                          </td>

                          {/* Total Computed */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#293381]/10 text-[#293381] dark:bg-[#36B4FF]/20 dark:text-[#36B4FF]">
                              {computedTotal} Days Total
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedEmpIds([emp.employeeId]);
                                setBulkForm({
                                  privilegeLeave: currentPL,
                                  casualLeave: currentCL,
                                  sickLeave: currentSL,
                                });
                                setShowBulkModal(true);
                              }}
                              className="inline-flex items-center gap-1 text-[#293381] dark:text-[#36B4FF] hover:underline font-semibold"
                            >
                              <Edit3 className="w-3 h-3" /> Edit Quota
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Employee Leave Applications Review Queue */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#293381] dark:text-white">
                  Employee Leave Applications
                </h2>
                <p className="text-[11px] text-slate-500">
                  Review submitted leave requests from employees across the organization.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {leaveRequests.filter((r) => r.status === "PENDING").length} Pending
              </span>
            </div>

            {leaveRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No employee leave applications submitted yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Absence Type</th>
                      <th className="py-3 px-4">Dates</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leaveRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          <div>{req.employeeName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{req.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-[#293381] border border-sky-200 text-[10px] font-bold">
                            {req.absenceType.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {req.startDate} → {req.endDate} ({req.totalDays}d)
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {req.reason || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {req.status === "PENDING" ? (
                            <>
                              <button
                                type="button"
                                disabled={reviewingLeaveId === req.id}
                                onClick={() => void handleReviewLeaveRequest(req.id, "APPROVE")}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={reviewingLeaveId === req.id}
                                onClick={() => void handleReviewLeaveRequest(req.id, "REJECT")}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ANNUAL HOLIDAY CALENDAR                            */}
      {/* ========================================================= */}
      {activeTab === "holiday" && (
        <div className="space-y-5">
          {holidayToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {holidayToast}
            </div>
          )}

          {/* Holiday Top Controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 mb-1">
                Calendar Year 2026 Active
              </div>
              <h2 className="text-lg font-bold text-[#293381] dark:text-white">
                Annual Public & Gazetted Holidays ({holidays.length} Days)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official paid non-working days for employee payroll calculations, timesheets, and leave policies.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleDownloadCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
              </button>

              <button
                onClick={() => {
                  setUploadPreview([]);
                  setUploadError(null);
                  setShowUploadModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#36B4FF]/40 bg-[#36B4FF]/10 text-[#293381] dark:text-[#36B4FF] hover:bg-[#36B4FF]/20 text-xs font-semibold transition shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-[#36B4FF]" />
                Upload Calendar
              </button>

              <button
                onClick={() => setShowAddHolidayModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Holiday
              </button>
            </div>
          </div>

          {/* Holiday List Grid */}
          {loadingHolidays ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-[#293381] mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Loading annual holidays...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
              No holidays added yet. Click &quot;Add Holiday&quot; or &quot;Upload Calendar&quot; to import.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {holidays.map((h) => {
                const dateParts = h.date.split("-");
                const monthNames = [
                  "JAN",
                  "FEB",
                  "MAR",
                  "APR",
                  "MAY",
                  "JUN",
                  "JUL",
                  "AUG",
                  "SEP",
                  "OCT",
                  "NOV",
                  "DEC",
                ];
                const month = monthNames[parseInt(dateParts[1], 10) - 1] || "---";
                const day = dateParts[2] || "00";

                return (
                  <div
                    key={h.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-card hover:border-[#36B4FF] transition relative flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Date Block */}
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#293381] to-[#1F2664] text-white flex flex-col items-center justify-center font-mono shadow-sm flex-shrink-0">
                            <span className="text-[10px] uppercase tracking-wider text-[#36B4FF] leading-none">
                              {month}
                            </span>
                            <span className="text-base font-bold leading-tight mt-0.5">{day}</span>
                          </div>

                          <div>
                            <h3 className="font-bold text-sm text-[#293381] dark:text-white leading-snug">
                              {h.name}
                            </h3>
                            <div className="text-[11px] text-slate-400 font-medium">
                              {h.dayOfWeek} • {h.date}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            h.type === "Gazetted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                          }`}
                        >
                          {h.type}
                        </span>
                      </div>

                      {h.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          {h.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 dark:border-slate-850">
                      <span>{h.location}</span>
                      <button
                        onClick={() => handleDeleteHoliday(h.id, h.name)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: BULK EDIT LEAVE QUOTAS                           */}
      {/* ========================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800 flex items-center justify-center">
                <Layers className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#293381] dark:text-white">
                  Bulk Edit Leave Quotas
                </h3>
                <p className="text-xs text-slate-400">
                  Targeting {selectedEmpIds.length} selected employee(s)
                </p>
              </div>
            </div>

            <form onSubmit={handleApplyBulkEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Privilege Leave (PL) Quota (Days / Year)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={bulkForm.privilegeLeave}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, privilegeLeave: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Casual Leave (CL) Quota (Days / Year)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  required
                  value={bulkForm.casualLeave}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, casualLeave: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sick Leave (SL) Quota (Days / Year)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  required
                  value={bulkForm.sickLeave}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, sickLeave: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Total Combined Quota:</span>
                <span className="text-[#293381] dark:text-[#36B4FF] text-sm font-bold font-mono">
                  {bulkForm.privilegeLeave + bulkForm.casualLeave + bulkForm.sickLeave} Days
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuotas}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {savingQuotas && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Apply to {selectedEmpIds.length} Employee(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD NEW HOLIDAY                                  */}
      {/* ========================================================= */}
      {showAddHolidayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#36B4FF]" />
              Add Holiday to Annual Calendar
            </h3>

            <form onSubmit={handleAddHolidaySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali (Deepavali)"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Holiday Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Holiday Type *
                  </label>
                  <select
                    value={newHoliday.type}
                    onChange={(e) =>
                      setNewHoliday({ ...newHoliday, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  >
                    <option value="Gazetted">Gazetted (Mandatory)</option>
                    <option value="Optional">Optional (Restricted)</option>
                    <option value="Company Off">Company Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Applicable Location
                </label>
                <input
                  type="text"
                  placeholder="All Locations or Regional"
                  value={newHoliday.location}
                  onChange={(e) => setNewHoliday({ ...newHoliday, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival of Lights"
                  value={newHoliday.description}
                  onChange={(e) =>
                    setNewHoliday({ ...newHoliday, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddHolidayModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingHoliday}
                  className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  {addingHoliday && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: UPLOAD ANNUAL HOLIDAY CALENDAR (CSV)             */}
      {/* ========================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#293381] dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#36B4FF]" />
                Upload Annual Holiday Calendar
              </h3>
              <button
                onClick={handleDownloadTemplate}
                className="text-[11px] text-[#36B4FF] hover:underline font-semibold flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Sample Template
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a CSV file containing annual holiday listings. Standard columns:{" "}
              <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                Name, Date (YYYY-MM-DD), Type, Location, Description
              </span>
            </p>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {uploadError}
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 text-center bg-slate-50 dark:bg-slate-800/40">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCSVFileChange}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#293381] file:text-white hover:file:bg-[#1F2664] cursor-pointer"
              />
            </div>

            {uploadPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">
                    Preview ({uploadPreview.length} Holidays Parsed):
                  </span>
                  <span className="text-emerald-600 font-bold">Ready to import</span>
                </div>
                <div className="max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {uploadPreview.map((item, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between bg-white dark:bg-slate-900">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{item.name}</span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.date} ({item.dayOfWeek})
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadPreview([]);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={uploadPreview.length === 0 || importingHolidays}
                className="px-4 py-2 rounded-lg bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {importingHolidays && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import {uploadPreview.length > 0 ? `${uploadPreview.length} Holidays` : "Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
