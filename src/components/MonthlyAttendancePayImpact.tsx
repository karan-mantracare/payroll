"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Download,
  Filter,
  RefreshCw,
  Search,
  User,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  ShieldAlert,
  ArrowRight,
  Info,
  Building,
  X,
  Plus,
  RotateCcw,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  AttendanceRecordLike,
  DayPayImpact,
  MonthlyPaySummary,
  SetOffType,
  calculateDayPayImpact,
  calculateBatchDayPayImpacts,
  calculateMonthlyPaySummary,
} from "@/lib/attendance/pay-impact";

interface MonthlyAttendancePayImpactProps {
  employeeId?: string; // If provided, locks view to this employee
  employeeCode?: string;
  employeeName?: string;
  initialSalary?: number;
  initialWorkingDays?: number;
  readOnlySalaryParams?: boolean;
}

export default function MonthlyAttendancePayImpact({
  employeeId,
  employeeCode,
  employeeName,
  initialSalary = 50000,
  initialWorkingDays = 22,
  readOnlySalaryParams = false,
}: MonthlyAttendancePayImpactProps) {
  // Current Month State (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Filters & State
  const [records, setRecords] = useState<AttendanceRecordLike[]>([]);
  const [employeePolicies, setEmployeePolicies] = useState<Record<string, any>>({});
  const [employeesList, setEmployeesList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>(employeeId || "");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [impactFilter, setImpactFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State (options: 10, 20, 50, 100, 250, 500)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filter Popover & Conditions Modal State (Matching User's Reference Portal)
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isFieldSettingsOpen, setIsFieldSettingsOpen] = useState<boolean>(false);
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>("");
  const [savedPreset, setSavedPreset] = useState<string>("ALL");
  const [saveSuccessToast, setSaveSuccessToast] = useState<boolean>(false);

  // Field Operators
  const [empNameOp, setEmpNameOp] = useState<"contains" | "is" | "starts_with">("contains");
  const [notesOp, setNotesOp] = useState<"contains" | "does_not_contain">("contains");

  // Enabled fields in Conditions (default to standard fields from user request)
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    empId: true,
    empName: true,
    date: true,
    setOff: true,
    assignedShift: true,
    notes: true,
    status: false,
    payImpact: false,
  });

  const [tempEnabledFields, setTempEnabledFields] = useState<Record<string, boolean>>({
    empId: true,
    empName: true,
    date: true,
    setOff: true,
    assignedShift: true,
    notes: true,
    status: false,
    payImpact: false,
  });

  // User-requested Filter States:
  // 1. Emp ID - Exact (text field)
  // 2. Emp Name
  // 3. Date - Exact, Less Than, Greater Than, Between
  // 4. Set Off - Exact (Drop down)
  // 5. Assigned Shift - Exact (Drop down)
  // 6. Deduction Rule & Notes - Contains
  const [filterEmpId, setFilterEmpId] = useState<string>("");
  const [filterEmpName, setFilterEmpName] = useState<string>("");
  const [filterDateMode, setFilterDateMode] = useState<"ALL" | "EXACT" | "LESS_THAN" | "GREATER_THAN" | "BETWEEN">("ALL");
  const [filterDate1, setFilterDate1] = useState<string>("");
  const [filterDate2, setFilterDate2] = useState<string>("");
  const [filterSetOff, setFilterSetOff] = useState<string>("ALL");
  const [filterShift, setFilterShift] = useState<string>("ALL");
  const [filterNotesQuery, setFilterNotesQuery] = useState<string>("");

  const ALL_FIELDS = [
    { id: "empId", label: "Emp ID", category: "STANDARD" },
    { id: "empName", label: "Emp Name", category: "STANDARD" },
    { id: "date", label: "Date", category: "STANDARD" },
    { id: "setOff", label: "Set Off", category: "STANDARD" },
    { id: "assignedShift", label: "Assigned Shift", category: "STANDARD" },
    { id: "notes", label: "Deduction Rule & Notes", category: "STANDARD" },
    { id: "status", label: "Status", category: "STANDARD" },
    { id: "payImpact", label: "Pay Impact", category: "STANDARD" },
  ];

  const SAVED_PRESETS = [
    { id: "ALL", label: "All schedules" },
    { id: "DEDUCTIONS", label: "Deductions Only" },
    { id: "GRACE_SHORT", label: "Grace & Short Leaves" },
    { id: "HALF_DAY", label: "Half Day Deductions" },
    { id: "UNAUTHORIZED", label: "Unauthorized Shifts" },
  ];

  const applyPreset = (presetId: string) => {
    setSavedPreset(presetId);
    if (presetId === "ALL") {
      resetAllFilters();
    } else if (presetId === "DEDUCTIONS") {
      resetAllFilters();
      setEnabledFields((prev) => ({ ...prev, payImpact: true }));
      setImpactFilter("DEDUCTIONS");
    } else if (presetId === "GRACE_SHORT") {
      resetAllFilters();
      setEnabledFields((prev) => ({ ...prev, setOff: true }));
      setFilterSetOff("Short Leave");
    } else if (presetId === "HALF_DAY") {
      resetAllFilters();
      setEnabledFields((prev) => ({ ...prev, setOff: true }));
      setFilterSetOff("Half Day");
    } else if (presetId === "UNAUTHORIZED") {
      resetAllFilters();
      setEnabledFields((prev) => ({ ...prev, notes: true }));
      setNotesOp("contains");
      setFilterNotesQuery("unauthorized shift");
    }
  };

  const handleSaveFilters = () => {
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 2500);
  };

  // Salary Parameters
  const [monthlySalary, setMonthlySalary] = useState<number>(initialSalary || 50000);
  const [workingDaysInMonth, setWorkingDaysInMonth] = useState<number>(initialWorkingDays || 22);
  const [standardShiftHours, setStandardShiftHours] = useState<number>(9);
  const [showSalaryConfig, setShowSalaryConfig] = useState<boolean>(false);

  // If initialSalary changes from props (e.g. sensitive financial load)
  useEffect(() => {
    if (initialSalary) setMonthlySalary(initialSalary);
  }, [initialSalary]);

  // Fetch Employees List for filter dropdown (if not locked to single employee)
  useEffect(() => {
    if (employeeId) return;
    async function loadEmployees() {
      try {
        const res = await fetch("/payroll/api/employees");
        if (res.ok) {
          const data = await res.json();
          const list = (data.employees || []).map((e: any) => ({
            id: e.id,
            code: e.employeeCode,
            name: e.user?.name || e.employeeCode,
          }));
          setEmployeesList(list);
        }
      } catch {
        // Fallback
      }
    }
    loadEmployees();
  }, [employeeId]);

  // Fetch Attendance Records for the Selected Month
  const fetchMonthRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDay = "01";
      const lastDayNumber = new Date(year, month, 0).getDate();
      const endDay = String(lastDayNumber).padStart(2, "0");

      const startDate = `${selectedMonth}-${startDay}`;
      const endDate = `${selectedMonth}-${endDay}`;

      const q = new URLSearchParams({
        startDate,
        endDate,
      });

      const empTarget = employeeId || selectedEmployeeFilter;
      if (empTarget) {
        q.set("employeeId", empTarget);
      }

      const res = await fetch(`/payroll/api/attendance?${q.toString()}`);
      if (!res.ok) throw new Error("Failed to load monthly attendance records.");
      const data = await res.json();
      setRecords(data.records || []);
      if (data.employeePolicies) {
        setEmployeePolicies(data.employeePolicies);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load monthly attendance.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, employeeId, selectedEmployeeFilter]);

  useEffect(() => {
    fetchMonthRecords();
  }, [fetchMonthRecords]);

  // Compute Day Pay Impacts with monthly Short Leave quota tracking per employee
  const calculatedImpacts = useMemo<DayPayImpact[]>(() => {
    return calculateBatchDayPayImpacts(records, {
      monthlySalary,
      workingDaysInMonth,
      standardShiftHours,
      employeePolicies,
    });
  }, [records, monthlySalary, workingDaysInMonth, standardShiftHours, employeePolicies]);

  // Distinct available shifts for Assigned Shift dropdown
  const availableShifts = useMemo(() => {
    const s = new Set<string>();
    for (const r of calculatedImpacts) {
      if (r.shiftName) s.add(r.shiftName);
    }
    return Array.from(s).sort();
  }, [calculatedImpacts]);

  // Filtered Impacts
  const filteredImpacts = useMemo<DayPayImpact[]>(() => {
    return calculatedImpacts.filter((item) => {
      // 0. Emp ID Filter (Exact text match)
      if (enabledFields.empId && filterEmpId.trim()) {
        const q = filterEmpId.trim().toLowerCase();
        const code = (item.employeeCode || "").trim().toLowerCase();
        const id = (item.employeeId || "").trim().toLowerCase();
        if (code !== q && id !== q) return false;
      }

      // 1. Emp Name Filter
      if (enabledFields.empName && filterEmpName.trim()) {
        const q = filterEmpName.toLowerCase();
        const n = (item.employeeName || "").toLowerCase();
        const c = (item.employeeCode || "").toLowerCase();
        if (empNameOp === "is") {
          if (n !== q && c !== q) return false;
        } else if (empNameOp === "starts_with") {
          if (!n.startsWith(q) && !c.startsWith(q)) return false;
        } else {
          // contains
          if (!n.includes(q) && !c.includes(q)) return false;
        }
      }

      // 2. Date Filter
      if (enabledFields.date) {
        if (filterDateMode === "EXACT" && filterDate1) {
          if (item.date !== filterDate1) return false;
        } else if (filterDateMode === "LESS_THAN" && filterDate1) {
          if (item.date >= filterDate1) return false;
        } else if (filterDateMode === "GREATER_THAN" && filterDate1) {
          if (item.date <= filterDate1) return false;
        } else if (filterDateMode === "BETWEEN") {
          if (filterDate1 && item.date < filterDate1) return false;
          if (filterDate2 && item.date > filterDate2) return false;
        }
      }

      // 3. Set Off Filter
      if (enabledFields.setOff && filterSetOff !== "ALL") {
        if (item.setOff !== filterSetOff) return false;
      }

      // 4. Assigned Shift Filter
      if (enabledFields.assignedShift && filterShift !== "ALL") {
        if (item.shiftName !== filterShift) return false;
      }

      // 5. Deduction Rule & Notes Filter
      if (enabledFields.notes && filterNotesQuery.trim()) {
        const nq = filterNotesQuery.toLowerCase();
        const matchesReason = item.reason?.toLowerCase().includes(nq);
        const matchesNotes = item.notes?.toLowerCase().includes(nq);
        const hasMatch = matchesReason || matchesNotes;
        if (notesOp === "does_not_contain") {
          if (hasMatch) return false;
        } else {
          if (!hasMatch) return false;
        }
      }

      // Status Filter (if enabled in Conditions)
      if (enabledFields.status && statusFilter !== "ALL") {
        if (item.status !== statusFilter) return false;
      }

      // Pay Impact Filter (if enabled in Conditions)
      if (enabledFields.payImpact && impactFilter !== "ALL") {
        if (impactFilter === "DEDUCTIONS" && item.deductionAmount === 0) return false;
        if (impactFilter === "FULL_PAY" && item.impactType !== "FULL_PAY" && item.impactType !== "LATE_COVERED") return false;
        if (impactFilter === "HALF_DAY" && item.impactType !== "HALF_DAY") return false;
        if (impactFilter === "FULL_DAY_LOP" && item.impactType !== "FULL_DAY_LOP") return false;
      }

      // Search Query (general search bar)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.employeeName?.toLowerCase().includes(q);
        const matchesCode = item.employeeCode?.toLowerCase().includes(q);
        const matchesDate = item.date.includes(q);
        const matchesShift = item.shiftName.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        const matchesReason = item.reason?.toLowerCase().includes(q);
        const matchesSetOff = item.setOff.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDate && !matchesShift && !matchesNotes && !matchesReason && !matchesSetOff) return false;
      }

      return true;
    });
  }, [
    calculatedImpacts,
    enabledFields,
    filterEmpId,
    filterEmpName,
    empNameOp,
    filterDateMode,
    filterDate1,
    filterDate2,
    filterSetOff,
    filterShift,
    filterNotesQuery,
    notesOp,
    statusFilter,
    impactFilter,
    searchQuery,
  ]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (enabledFields.empId && filterEmpId.trim()) count++;
    if (enabledFields.empName && filterEmpName.trim()) count++;
    if (enabledFields.date && filterDateMode !== "ALL" && (filterDate1 || filterDate2)) count++;
    if (enabledFields.setOff && filterSetOff !== "ALL") count++;
    if (enabledFields.assignedShift && filterShift !== "ALL") count++;
    if (enabledFields.notes && filterNotesQuery.trim()) count++;
    if (enabledFields.status && statusFilter !== "ALL") count++;
    if (enabledFields.payImpact && impactFilter !== "ALL") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    enabledFields,
    filterEmpId,
    filterEmpName,
    filterDateMode,
    filterDate1,
    filterDate2,
    filterSetOff,
    filterShift,
    filterNotesQuery,
    statusFilter,
    impactFilter,
    searchQuery,
  ]);

  const resetAllFilters = () => {
    setFilterEmpId("");
    setFilterEmpName("");
    setEmpNameOp("contains");
    setFilterDateMode("ALL");
    setFilterDate1("");
    setFilterDate2("");
    setFilterSetOff("ALL");
    setFilterShift("ALL");
    setFilterNotesQuery("");
    setNotesOp("contains");
    setStatusFilter("ALL");
    setImpactFilter("ALL");
    setSearchQuery("");
    setSavedPreset("ALL");
  };

  // Summary Metrics
  const summary = useMemo<MonthlyPaySummary>(() => {
    return calculateMonthlyPaySummary(calculatedImpacts, {
      month: selectedMonth,
      monthlySalary,
      workingDaysInMonth,
      standardShiftHours,
    });
  }, [calculatedImpacts, selectedMonth, monthlySalary, workingDaysInMonth, standardShiftHours]);

  // Reset current page when filters or month change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedMonth,
    pageSize,
    filterEmpId,
    filterEmpName,
    filterDateMode,
    filterDate1,
    filterDate2,
    filterSetOff,
    filterShift,
    filterNotesQuery,
    statusFilter,
    impactFilter,
    searchQuery,
    savedPreset,
  ]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredImpacts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredImpacts.length);
  const paginatedImpacts = useMemo(() => {
    return filteredImpacts.slice(startIndex, endIndex);
  }, [filteredImpacts, startIndex, endIndex]);

  // Navigation handlers for prev/next month (pure calendar arithmetic, immune to timezone/UTC shift bugs)
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredImpacts.length === 0) return;
    const headers = [
      "Date",
      "Day",
      "Employee Code",
      "Employee Name",
      "Assigned Shift",
      "Check-In",
      "Check-Out",
      "Duration",
      "Status",
      "Set-off",
      "Day's Pay Impact",
      "Deduction Amount (INR)",
      "Net Day Pay (INR)",
      "Calculation Reason",
    ];

    const rows = filteredImpacts.map((item) => [
      item.date,
      item.dayOfWeek,
      `"${item.employeeCode || ""}"`,
      `"${item.employeeName || ""}"`,
      `"${item.shiftName}"`,
      item.checkIn,
      item.checkOut,
      item.durationFormatted,
      item.status,
      `"${item.setOff}"`,
      `"${item.badgeLabel}"`,
      item.deductionAmount,
      item.netDayPay,
      `"${item.reason.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Monthly_Attendance_Pay_Impact_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#293381] dark:text-[#36B4FF]" />
              Monthly Attendance & Day's Pay Impact
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {employeeName
                ? `Daily attendance ledger and salary impact calculations for ${employeeName} (${employeeCode})`
                : "Comprehensive daily attendance audit and computed payroll deduction impact per day."}
            </p>
          </div>

          {/* Month Selector with Prev/Next buttons */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer shadow-2xs group">
              <Calendar className="w-3.5 h-3.5 text-[#293381] dark:text-[#36B4FF] shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap select-none">
                {monthLabel}
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                title="Click to select month"
              />
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Action Row with Modern Popover Filter System (Matching User Reference) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input with Popover Filter Pill */}
            <div className="relative flex-1 max-w-xl">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs focus-within:border-[#0084c7] focus-within:ring-2 focus-within:ring-[#0084c7]/20 transition">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterOpen(!isFilterOpen);
                    setIsFieldSettingsOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold border border-[#38bdf8] text-[#0284c7] bg-[#f0f9ff] dark:bg-[#0284c7]/20 dark:text-[#38bdf8] dark:border-[#0284c7]/40 hover:bg-[#e0f2fe] transition flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
                >
                  <span>
                    {savedPreset === "DEDUCTIONS"
                      ? "Deductions Only"
                      : savedPreset === "GRACE_SHORT"
                      ? "Grace & Short Leaves"
                      : savedPreset === "HALF_DAY"
                      ? "Half Day Deductions"
                      : savedPreset === "UNAUTHORIZED"
                      ? "Unauthorized Shifts"
                      : activeFiltersCount > 0
                      ? `${activeFiltersCount} filter${activeFiltersCount > 1 ? "s" : ""} applied`
                      : "All schedules"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-[#0284c7] dark:text-[#38bdf8] transition-transform ${
                      isFilterOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* The Dropdown Popover Modal (Images 3, 4, 5) */}
              {isFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30"
                    onClick={() => setIsFilterOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-50 w-full min-w-[580px] max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="flex flex-col md:flex-row min-h-[320px]">
                      {/* Left Sidebar: SAVED FILTERS */}
                      <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950/20 shrink-0 space-y-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                          SAVED FILTERS
                        </div>
                        {SAVED_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPreset(preset.id)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              savedPreset === preset.id
                                ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0084c7] dark:text-[#38bdf8] shadow-2xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Right Panel: CONDITIONS or FILTER FIELD SETTINGS */}
                      <div className="flex-1 flex flex-col justify-between min-h-[340px]">
                        {!isFieldSettingsOpen ? (
                          <>
                            {/* Normal Conditions View (Images 2, 4) */}
                            <div className="p-5 space-y-4 max-h-[300px] overflow-y-auto pr-1">
                              <div className="flex items-center justify-between pb-1">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                  CONDITIONS
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsFilterOpen(false)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                                  title="Close"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Condition 0: Emp ID (Exact) */}
                              {enabledFields.empId && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Emp ID
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, empId: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                      title="Remove filter"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      disabled
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
                                    >
                                      <option>Exact (Is)</option>
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Value... (e.g. EMP-001)"
                                      value={filterEmpId}
                                      onChange={(e) => setFilterEmpId(e.target.value)}
                                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Condition 1: Emp Name */}
                              {enabledFields.empName && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Emp Name
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, empName: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      value={empNameOp}
                                      onChange={(e) => setEmpNameOp(e.target.value as any)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="contains">Contains</option>
                                      <option value="is">Is</option>
                                      <option value="starts_with">Starts with</option>
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Value..."
                                      value={filterEmpName}
                                      onChange={(e) => setFilterEmpName(e.target.value)}
                                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Condition 2: Date */}
                              {enabledFields.date && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Date
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, date: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      value={filterDateMode}
                                      onChange={(e) => setFilterDateMode(e.target.value as any)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="ALL">All Dates</option>
                                      <option value="EXACT">Is (Exact)</option>
                                      <option value="LESS_THAN">Less than (&lt;)</option>
                                      <option value="GREATER_THAN">Greater than (&gt;)</option>
                                      <option value="BETWEEN">Between</option>
                                    </select>

                                    {filterDateMode === "BETWEEN" ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="date"
                                          value={filterDate1}
                                          onChange={(e) => setFilterDate1(e.target.value)}
                                          className="w-1/2 text-[11px] px-1.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                        />
                                        <span className="text-[10px] text-slate-400">-</span>
                                        <input
                                          type="date"
                                          value={filterDate2}
                                          onChange={(e) => setFilterDate2(e.target.value)}
                                          className="w-1/2 text-[11px] px-1.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                        />
                                      </div>
                                    ) : (
                                      <input
                                        type="date"
                                        disabled={filterDateMode === "ALL"}
                                        value={filterDate1}
                                        onChange={(e) => setFilterDate1(e.target.value)}
                                        placeholder="Value..."
                                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0084c7] disabled:opacity-50"
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Condition 3: Set Off */}
                              {enabledFields.setOff && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Set Off
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, setOff: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      disabled
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
                                    >
                                      <option>Is</option>
                                    </select>
                                    <select
                                      value={filterSetOff}
                                      onChange={(e) => setFilterSetOff(e.target.value)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="ALL">Value... (All Set-offs)</option>
                                      <option value="Grace Period">Grace Period</option>
                                      <option value="Short Leave">Short Leave</option>
                                      <option value="Leave">Leave</option>
                                      <option value="Half Day">Half Day</option>
                                      <option value="Shift Exception">Shift Exception</option>
                                      <option value="Comp Off">Comp Off</option>
                                      <option value="None">None (—)</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {/* Condition 4: Assigned Shift */}
                              {enabledFields.assignedShift && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Assigned Shift
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, assignedShift: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      disabled
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
                                    >
                                      <option>Is</option>
                                    </select>
                                    <select
                                      value={filterShift}
                                      onChange={(e) => setFilterShift(e.target.value)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="ALL">Value... (All Shifts)</option>
                                      {availableShifts.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}

                              {/* Condition 5: Deduction Rule & Notes */}
                              {enabledFields.notes && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Deduction Rule & Notes
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, notes: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      value={notesOp}
                                      onChange={(e) => setNotesOp(e.target.value as any)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="contains">Contains</option>
                                      <option value="does_not_contain">Does not contain</option>
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Value..."
                                      value={filterNotesQuery}
                                      onChange={(e) => setFilterNotesQuery(e.target.value)}
                                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Condition 6: Status */}
                              {enabledFields.status && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Status
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, status: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      disabled
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
                                    >
                                      <option>Is</option>
                                    </select>
                                    <select
                                      value={statusFilter}
                                      onChange={(e) => setStatusFilter(e.target.value)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="ALL">Value... (All Statuses)</option>
                                      <option value="PRESENT">PRESENT</option>
                                      <option value="HALF_DAY">HALF_DAY</option>
                                      <option value="LATE">LATE</option>
                                      <option value="ABSENT">ABSENT</option>
                                      <option value="ON_LEAVE">ON_LEAVE</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {/* Condition 7: Pay Impact */}
                              {enabledFields.payImpact && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      Pay Impact
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEnabledFields((prev) => ({ ...prev, payImpact: false }))}
                                      className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      disabled
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
                                    >
                                      <option>Is</option>
                                    </select>
                                    <select
                                      value={impactFilter}
                                      onChange={(e) => setImpactFilter(e.target.value)}
                                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                    >
                                      <option value="ALL">Value... (All Impacts)</option>
                                      <option value="DEDUCTIONS">Deductions Only</option>
                                      <option value="FULL_PAY">Full Pay (100%)</option>
                                      <option value="HALF_DAY">Half Day (-50%)</option>
                                      <option value="FULL_DAY_LOP">Full Day LOP (-100%)</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {/* + Add field link (Images 2, 4) */}
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTempEnabledFields({ ...enabledFields });
                                    setIsFieldSettingsOpen(true);
                                  }}
                                  className="text-xs font-semibold text-[#0084c7] hover:text-[#0073ad] flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add field</span>
                                </button>
                              </div>
                            </div>

                            {/* Conditions Bottom Footer (Images 2, 4) */}
                            <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between bg-white dark:bg-slate-900 text-xs">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveFilters}
                                  className="text-slate-600 dark:text-slate-400 hover:text-[#0084c7] underline font-medium cursor-pointer"
                                >
                                  Save filters
                                </button>
                                {saveSuccessToast && (
                                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Filters saved!
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={resetAllFilters}
                                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium px-2 py-1 cursor-pointer"
                                >
                                  Reset
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsFilterOpen(false)}
                                  className="bg-[#0084c7] hover:bg-[#0073ad] text-white font-semibold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                  <span>Search</span>
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* Filter Field Settings Modal (Image 3) */
                          <div className="p-5 flex-1 flex flex-col justify-between">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  FILTER FIELD SETTINGS
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsFieldSettingsOpen(false)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                                  title="Close Settings"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Find Field input */}
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Find field"
                                  value={fieldSearchQuery}
                                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0084c7]"
                                />
                              </div>

                              {/* Standard category */}
                              <div>
                                <div className="text-[11px] font-bold text-[#0084c7] uppercase tracking-wider mb-2.5">
                                  STANDARD
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 text-xs">
                                  {ALL_FIELDS.filter((f) =>
                                    f.label.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                                  ).map((field) => (
                                    <label
                                      key={field.id}
                                      className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Boolean(tempEnabledFields[field.id])}
                                        onChange={(e) =>
                                          setTempEnabledFields((prev) => ({
                                            ...prev,
                                            [field.id]: e.target.checked,
                                          }))
                                        }
                                        className="w-4 h-4 text-[#0084c7] rounded border-slate-300 focus:ring-[#0084c7]"
                                      />
                                      <span>{field.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Field Settings Controls Footer */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                              <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={ALL_FIELDS.every((f) => tempEnabledFields[f.id])}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    const updated: Record<string, boolean> = {};
                                    ALL_FIELDS.forEach((f) => (updated[f.id] = val));
                                    setTempEnabledFields(updated);
                                  }}
                                  className="w-3.5 h-3.5 text-[#0084c7] rounded border-slate-300"
                                />
                                <span>select all</span>
                              </label>

                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTempEnabledFields({
                                      empId: true,
                                      empName: true,
                                      date: true,
                                      setOff: true,
                                      assignedShift: true,
                                      notes: true,
                                      status: false,
                                      payImpact: false,
                                    });
                                  }}
                                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>default</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsFieldSettingsOpen(false)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer font-semibold"
                                >
                                  CANCEL
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEnabledFields({ ...tempEnabledFields });
                                    setIsFieldSettingsOpen(false);
                                  }}
                                  className="px-4 py-1.5 rounded-lg bg-[#0084c7] hover:bg-[#0073ad] text-white font-semibold shadow-xs cursor-pointer"
                                >
                                  APPLY
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Buttons: Rates, Refresh, Export CSV */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Toggle Salary Parameters drawer */}
              <button
                type="button"
                onClick={() => setShowSalaryConfig(!showSalaryConfig)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                  showSalaryConfig
                    ? "bg-[#293381] text-white border-[#293381] dark:bg-[#36B4FF] dark:text-slate-950"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Rates ({summary.dailyRate.toLocaleString("en-IN")}/day)</span>
              </button>

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchMonthRecords}
                disabled={loading}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition cursor-pointer"
                title="Refresh Records"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#293381]" : ""}`} />
              </button>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredImpacts.length === 0}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Active Filter Chips Bar (Shown under search bar when conditions are set) */}
          {activeFiltersCount > 0 && !isFilterOpen && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Active:
              </span>
              {enabledFields.empId && filterEmpId.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Emp ID (Exact): &quot;{filterEmpId}&quot;
                  <button type="button" onClick={() => setFilterEmpId("")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.empName && filterEmpName.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Emp ({empNameOp}): &quot;{filterEmpName}&quot;
                  <button type="button" onClick={() => setFilterEmpName("")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.date && filterDateMode !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Date: {filterDateMode} {filterDate1} {filterDate2 ? `- ${filterDate2}` : ""}
                  <button type="button" onClick={() => setFilterDateMode("ALL")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.setOff && filterSetOff !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Set-off: {filterSetOff}
                  <button type="button" onClick={() => setFilterSetOff("ALL")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.assignedShift && filterShift !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Shift: {filterShift}
                  <button type="button" onClick={() => setFilterShift("ALL")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.notes && filterNotesQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Rule/Notes ({notesOp}): &quot;{filterNotesQuery}&quot;
                  <button type="button" onClick={() => setFilterNotesQuery("")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.status && statusFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter("ALL")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {enabledFields.payImpact && impactFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0084c7] border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs">
                  Pay Impact: {impactFilter}
                  <button type="button" onClick={() => setImpactFilter("ALL")} className="hover:text-rose-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 ml-1 underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Salary Configuration Bar */}
        {showSalaryConfig && (
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Monthly Basic Salary
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  disabled={readOnlySalaryParams}
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(Number(e.target.value) || 0)}
                  className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Working Days in Month
              </label>
              <input
                type="number"
                min="15"
                max="31"
                disabled={readOnlySalaryParams}
                value={workingDaysInMonth}
                onChange={(e) => setWorkingDaysInMonth(Number(e.target.value) || 22)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Standard Shift Hours
              </label>
              <input
                type="number"
                min="4"
                max="12"
                disabled={readOnlySalaryParams}
                value={standardShiftHours}
                onChange={(e) => setStandardShiftHours(Number(e.target.value) || 9)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-col justify-end">
              <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Daily Rate:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{summary.dailyRate.toLocaleString("en-IN")}/day
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                  <span>Hourly Rate:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{summary.hourlyRate.toLocaleString("en-IN")}/hr
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Tracked Days */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Tracked Days
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {summary.totalDaysTracked}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Records in {monthLabel}</p>
        </div>

        {/* 2. Full Pay Days */}
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Full Pay (100%)
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">
            {summary.fullPayDays}
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">
            100% pay earned
          </p>
        </div>

        {/* 3. Half Day Deductions */}
        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Half Day (-50%)
          </div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-2">
            {summary.halfDayCount}
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
            -₹{(summary.halfDayCount * Math.round(summary.dailyRate * 0.5)).toLocaleString("en-IN")}
          </p>
        </div>

        {/* 4. Full Day Loss of Pay */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 shadow-xs">
          <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Full Day LOP
          </div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-2">
            {summary.fullDayLopCount}
          </div>
          <p className="text-[10px] text-rose-600 dark:text-rose-500 mt-0.5">
            -₹{(summary.fullDayLopCount * summary.dailyRate).toLocaleString("en-IN")}
          </p>
        </div>

        {/* 5. Total Deductions */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            Total Deductions
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            -₹{summary.totalDeductions.toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {summary.latePenaltyCount > 0 ? `${summary.latePenaltyCount} late hr penalties` : "From punch penalties"}
          </p>
        </div>

        {/* 6. Net Month Pay */}
        <div className="p-4 rounded-xl bg-[#293381]/5 dark:bg-[#36B4FF]/10 border border-[#293381]/20 dark:border-[#36B4FF]/30 shadow-xs">
          <div className="text-[11px] font-bold text-[#293381] dark:text-[#36B4FF] uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Net Month Pay
          </div>
          <div className="text-xl font-extrabold text-[#293381] dark:text-[#36B4FF] mt-2">
            ₹{summary.totalNetPay.toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">
            {summary.effectivePayableDays} Payable Days
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Daily Attendance & Pay Impact Ledger
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              ({filteredImpacts.length} entries shown)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>100% Pay</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span>-50% LOP</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span>-100% LOP</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-[#293381] dark:text-[#36B4FF] mb-2" />
            <span>Calculating monthly attendance & salary impacts...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : filteredImpacts.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              No attendance records found for {monthLabel}.
            </p>
            <p className="text-[11px]">
              Import biometric punches via the Attendance Import tool or navigate to another month.
            </p>
          </div>
        ) : (
          <div>
            {/* Scrollable Table without Word Wrapping */}
            <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[1350px] text-left text-xs whitespace-nowrap divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Date & Day</th>
                    {!employeeId && <th className="px-4 py-3 whitespace-nowrap">Employee</th>}
                    <th className="px-4 py-3 whitespace-nowrap">Assigned Shift</th>
                    <th className="px-4 py-3 whitespace-nowrap">Check-In</th>
                    <th className="px-4 py-3 whitespace-nowrap">Check-Out</th>
                    <th className="px-4 py-3 whitespace-nowrap">Duration</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Set-off</th>
                    <th className="px-4 py-3 whitespace-nowrap">Day's Pay Impact</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Net Day Pay</th>
                    <th className="px-4 py-3 whitespace-nowrap">Deduction Rule & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedImpacts.map((item, idx) => {
                    const isDeduction = item.deductionAmount > 0;
                    return (
                      <tr
                        key={item.recordId || idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                      >
                        {/* Date & Day */}
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.date}
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans uppercase">
                            {item.dayOfWeek}
                          </span>
                        </td>

                        {/* Employee (if showing multiple) */}
                        {!employeeId && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {item.employeeName || "--"}
                            </div>
                            <div className="font-mono text-[10px] text-[#36B4FF]">
                              {item.employeeCode}
                            </div>
                          </td>
                        )}

                        {/* Shift */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white text-xs">
                            {item.shiftName}
                          </div>
                          {item.hasGraceApplied ? (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-[#293381] dark:text-[#36B4FF]">
                                {item.effectiveShiftTiming}
                              </span>
                              {item.effectiveShiftTiming !== item.scheduledShiftTiming && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  (Base: {item.scheduledShiftTiming})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.scheduledShiftTiming}
                            </div>
                          )}
                        </td>

                        {/* In Time */}
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <span className={item.checkIn === "--" ? "text-rose-500 font-bold" : "text-slate-700 dark:text-slate-300"}>
                            {item.checkIn}
                          </span>
                        </td>

                        {/* Out Time */}
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <span className={item.checkOut === "--" ? "text-rose-500 font-bold" : "text-slate-700 dark:text-slate-300"}>
                            {item.checkOut}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              item.durationMinutes < 270 && item.durationMinutes > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {item.durationFormatted}
                          </span>
                        </td>

                        {/* Attendance Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === "PRESENT"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : item.status === "HALF_DAY"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : item.status === "LATE"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Set-off */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.setOff !== "None" ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border shadow-2xs inline-block ${
                                item.setOff === "Grace Period"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                                  : item.setOff === "Short Leave"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : item.setOff === "Leave"
                                  ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                                  : item.setOff === "Half Day"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                  : item.setOff === "Shift Exception"
                                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                                  : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800"
                              }`}
                            >
                              {item.setOff}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Day's Pay Impact Badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shadow-2xs ${
                                item.badgeColor === "emerald"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                  : item.badgeColor === "amber"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                  : item.badgeColor === "orange"
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                              }`}
                            >
                              {item.badgeLabel}
                            </span>
                          </div>
                        </td>

                        {/* Net Day Pay */}
                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                          <div
                            className={`font-bold ${
                              item.netDayPay === 0
                                ? "text-rose-600 dark:text-rose-400"
                                : isDeduction
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            ₹{item.netDayPay.toLocaleString("en-IN")}
                          </div>
                          {isDeduction && (
                            <div className="text-[10px] text-rose-500 font-sans font-semibold">
                              -₹{item.deductionAmount.toLocaleString("en-IN")}
                            </div>
                          )}
                        </td>

                        {/* Deduction Reason & Notes */}
                        <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {item.reason}
                            </span>
                            {item.notes && item.notes !== item.reason && (
                              <span className="text-[10px] text-slate-400 italic">
                                | {item.notes}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400">
                <span>
                  Showing{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {filteredImpacts.length === 0 ? 0 : startIndex + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {endIndex}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {filteredImpacts.length}
                  </span>{" "}
                  entries
                </span>

                <div className="flex items-center gap-1.5 pl-3 border-l border-slate-300 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381] cursor-pointer"
                  >
                    {[10, 20, 50, 100, 250, 500].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Page Nav Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg select-none">
                  Page {safeCurrentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
