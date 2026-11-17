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
  ShieldAlert,
  ArrowRight,
  Info,
  Building,
  X,
} from "lucide-react";
import {
  AttendanceRecordLike,
  DayPayImpact,
  MonthlyPaySummary,
  SetOffType,
  calculateDayPayImpact,
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
  const [employeesList, setEmployeesList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>(employeeId || "");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [impactFilter, setImpactFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // User-requested Filter States:
  // 1. Emp Name
  // 2. Date - Exact, Less Than, Greater Than, Between
  // 3. Set Off - Exact (Drop down)
  // 4. Assigned Shift - Exact (Drop down)
  // 5. Deduction Rule & Notes - Contains
  const [filterEmpName, setFilterEmpName] = useState<string>("");
  const [filterDateMode, setFilterDateMode] = useState<"ALL" | "EXACT" | "LESS_THAN" | "GREATER_THAN" | "BETWEEN">("ALL");
  const [filterDate1, setFilterDate1] = useState<string>("");
  const [filterDate2, setFilterDate2] = useState<string>("");
  const [filterSetOff, setFilterSetOff] = useState<string>("ALL");
  const [filterShift, setFilterShift] = useState<string>("ALL");
  const [filterNotesQuery, setFilterNotesQuery] = useState<string>("");

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
    } catch (err: any) {
      setError(err.message || "Failed to load monthly attendance.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, employeeId, selectedEmployeeFilter]);

  useEffect(() => {
    fetchMonthRecords();
  }, [fetchMonthRecords]);

  // Compute Day Pay Impacts
  const calculatedImpacts = useMemo<DayPayImpact[]>(() => {
    return records.map((record) =>
      calculateDayPayImpact(record, {
        monthlySalary,
        workingDaysInMonth,
        standardShiftHours,
      })
    );
  }, [records, monthlySalary, workingDaysInMonth, standardShiftHours]);

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
      // 1. Emp Name Filter (matches employee name or employee code)
      if (filterEmpName.trim()) {
        const q = filterEmpName.toLowerCase();
        const matchesName = item.employeeName?.toLowerCase().includes(q);
        const matchesCode = item.employeeCode?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }

      // 2. Date Filter (Exact, Less Than, Greater Than, Between)
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

      // 3. Set Off Filter (Exact Drop down)
      if (filterSetOff !== "ALL") {
        if (item.setOff !== filterSetOff) return false;
      }

      // 4. Assigned Shift Filter (Exact Drop down)
      if (filterShift !== "ALL") {
        if (item.shiftName !== filterShift) return false;
      }

      // 5. Deduction Rule & Notes Filter (Contains)
      if (filterNotesQuery.trim()) {
        const nq = filterNotesQuery.toLowerCase();
        const matchesReason = item.reason?.toLowerCase().includes(nq);
        const matchesNotes = item.notes?.toLowerCase().includes(nq);
        if (!matchesReason && !matchesNotes) return false;
      }

      // Status Filter
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;

      // Pay Impact Filter
      if (impactFilter === "DEDUCTIONS" && item.deductionAmount === 0) return false;
      if (impactFilter === "FULL_PAY" && item.impactType !== "FULL_PAY" && item.impactType !== "LATE_COVERED") return false;
      if (impactFilter === "HALF_DAY" && item.impactType !== "HALF_DAY") return false;
      if (impactFilter === "FULL_DAY_LOP" && item.impactType !== "FULL_DAY_LOP") return false;

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

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterEmpName.trim()) count++;
    if (filterDateMode !== "ALL" && (filterDate1 || filterDate2)) count++;
    if (filterSetOff !== "ALL") count++;
    if (filterShift !== "ALL") count++;
    if (filterNotesQuery.trim()) count++;
    if (statusFilter !== "ALL") count++;
    if (impactFilter !== "ALL") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
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
    setFilterEmpName("");
    setFilterDateMode("ALL");
    setFilterDate1("");
    setFilterDate2("");
    setFilterSetOff("ALL");
    setFilterShift("ALL");
    setFilterNotesQuery("");
    setStatusFilter("ALL");
    setImpactFilter("ALL");
    setSearchQuery("");
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

  // Navigation handlers for prev/next month
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(prevDate.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(nextDate.toISOString().slice(0, 7));
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
          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              />
              <span className="hidden md:inline text-xs font-semibold text-[#293381] dark:text-[#36B4FF] border-l border-slate-300 dark:border-slate-700 pl-2">
                {monthLabel}
              </span>
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

        {/* Top Action Row: Rates & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#293381] dark:text-[#36B4FF]" />
              Filter Records
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#293381] text-white dark:bg-[#36B4FF] dark:text-slate-950">
                {activeFiltersCount} active
              </span>
            )}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 hover:underline ml-2"
              >
                <X className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Salary Parameters drawer */}
            <button
              type="button"
              onClick={() => setShowSalaryConfig(!showSalaryConfig)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
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
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition"
              title="Refresh Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#293381]" : ""}`} />
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredImpacts.length === 0}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* User-Requested Filters Grid */}
        <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Filter 1: Emp Name */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Emp Name
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Name or code..."
                value={filterEmpName}
                onChange={(e) => setFilterEmpName(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#293381]"
              />
            </div>
          </div>

          {/* Filter 2: Date - Exact, Less Than, Greater Than, Between */}
          <div className={filterDateMode === "BETWEEN" ? "sm:col-span-2 lg:col-span-2" : ""}>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Date ({filterDateMode === "ALL" ? "All" : filterDateMode === "EXACT" ? "Exact" : filterDateMode === "LESS_THAN" ? "<" : filterDateMode === "GREATER_THAN" ? ">" : "Range"})
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={filterDateMode}
                onChange={(e) => setFilterDateMode(e.target.value as any)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381] shrink-0"
              >
                <option value="ALL">All Dates</option>
                <option value="EXACT">Exact (=)</option>
                <option value="LESS_THAN">Less Than (&lt;)</option>
                <option value="GREATER_THAN">Greater Than (&gt;)</option>
                <option value="BETWEEN">Between</option>
              </select>

              {filterDateMode === "EXACT" || filterDateMode === "LESS_THAN" || filterDateMode === "GREATER_THAN" ? (
                <input
                  type="date"
                  value={filterDate1}
                  onChange={(e) => setFilterDate1(e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381]"
                />
              ) : filterDateMode === "BETWEEN" ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="date"
                    value={filterDate1}
                    onChange={(e) => setFilterDate1(e.target.value)}
                    className="w-1/2 text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381]"
                    placeholder="From"
                  />
                  <span className="text-[10px] text-slate-400">to</span>
                  <input
                    type="date"
                    value={filterDate2}
                    onChange={(e) => setFilterDate2(e.target.value)}
                    className="w-1/2 text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381]"
                    placeholder="To"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Filter 3: Set Off - Exact (Drop down) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Set Off (Exact)
            </label>
            <select
              value={filterSetOff}
              onChange={(e) => setFilterSetOff(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381]"
            >
              <option value="ALL">All Set-offs</option>
              <option value="Grace Period">Grace Period</option>
              <option value="Short Leave">Short Leave</option>
              <option value="Leave">Leave</option>
              <option value="Half Day">Half Day</option>
              <option value="Shift Exception">Shift Exception</option>
              <option value="Comp Off">Comp Off</option>
              <option value="None">None (—)</option>
            </select>
          </div>

          {/* Filter 4: Assigned Shift - Exact (Drop down) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Assigned Shift
            </label>
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381]"
            >
              <option value="ALL">All Shifts ({availableShifts.length})</option>
              {availableShifts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 5: Deduction Rule & Notes - Contains */}
          <div className={filterDateMode === "BETWEEN" ? "lg:col-span-2" : ""}>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Deduction Rule & Notes (Contains)
            </label>
            <input
              type="text"
              placeholder="Contains in rule or notes..."
              value={filterNotesQuery}
              onChange={(e) => setFilterNotesQuery(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#293381]"
            />
          </div>

          {/* Additional Filter: Pay Impact */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Pay Impact
            </label>
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#293381]"
            >
              <option value="ALL">All Impacts</option>
              <option value="DEDUCTIONS">Deductions Only</option>
              <option value="FULL_PAY">Full Pay (100%)</option>
              <option value="HALF_DAY">Half Day (-50%)</option>
              <option value="FULL_DAY_LOP">Full Day LOP (-100%)</option>
            </select>
          </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date & Day</th>
                  {!employeeId && <th className="px-4 py-3">Employee</th>}
                  <th className="px-4 py-3">Assigned Shift</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Set-off</th>
                  <th className="px-4 py-3">Day's Pay Impact</th>
                  <th className="px-4 py-3 text-right">Net Day Pay</th>
                  <th className="px-4 py-3">Deduction Rule & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredImpacts.map((item, idx) => {
                  const isDeduction = item.deductionAmount > 0;
                  return (
                    <tr
                      key={item.recordId || idx}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Date & Day */}
                      <td className="px-4 py-3 font-mono">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.date}
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase">
                          {item.dayOfWeek}
                        </span>
                      </td>

                      {/* Employee (if showing multiple) */}
                      {!employeeId && (
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.employeeName || "--"}
                          </div>
                          <div className="font-mono text-[10px] text-[#36B4FF]">
                            {item.employeeCode}
                          </div>
                        </td>
                      )}

                      {/* Shift */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">
                          {item.shiftName}
                        </div>
                        {item.hasGraceApplied ? (
                          <div className="mt-0.5 space-y-0.5">
                            <span className="font-mono text-[11px] font-bold text-[#293381] dark:text-[#36B4FF] block">
                              {item.effectiveShiftTiming}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Base: {item.scheduledShiftTiming}
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.scheduledShiftTiming}
                          </div>
                        )}
                      </td>

                      {/* In Time */}
                      <td className="px-4 py-3 font-mono">
                        <span className={item.checkIn === "--" ? "text-rose-500 font-bold" : "text-slate-700 dark:text-slate-300"}>
                          {item.checkIn}
                        </span>
                      </td>

                      {/* Out Time */}
                      <td className="px-4 py-3 font-mono">
                        <span className={item.checkOut === "--" ? "text-rose-500 font-bold" : "text-slate-700 dark:text-slate-300"}>
                          {item.checkOut}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 font-mono">
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-right font-mono">
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
                      <td className="px-4 py-3 text-[11px] text-slate-500 max-w-xs leading-relaxed">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.reason}
                        </span>
                        {item.notes && item.notes !== item.reason && (
                          <span className="block text-[10px] text-slate-400 italic mt-0.5">
                            {item.notes}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
