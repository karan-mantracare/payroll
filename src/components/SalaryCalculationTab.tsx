"use client";

import React, { useState, useEffect } from "react";
import MonthlyAttendancePayImpact from "./MonthlyAttendancePayImpact";

interface SalaryCalculationTabProps {
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  basicSalary?: number;
}

export default function SalaryCalculationTab({
  employeeId,
  employeeCode,
  employeeName,
  basicSalary = 50000,
}: SalaryCalculationTabProps) {
  const [monthlySalary, setMonthlySalary] = useState(basicSalary || 50000);
  const [workingDaysInMonth, setWorkingDaysInMonth] = useState(22);

  // Attempt to load employee's actual basic salary & working schedule
  useEffect(() => {
    async function loadEmployeeDetails() {
      if (!employeeId || employeeId === "org") return;
      try {
        const res = await fetch(`/payroll/api/employees/${employeeId}/sensitive`);
        if (res.ok) {
          const json = await res.json();
          if (json.details?.basicSalary && typeof json.details.basicSalary === "number") {
            setMonthlySalary(json.details.basicSalary);
          }
        }

        const resPolicy = await fetch(`/payroll/api/employees/${employeeId}/leaves-offs`);
        if (resPolicy.ok) {
          const polJson = await resPolicy.json();
          if (polJson.data) {
            const daysPerWeek = polJson.data.workingDaysPerWeek || 6;
            setWorkingDaysInMonth(daysPerWeek === 6 ? 26 : 22);
          }
        }
      } catch {
        // Fallback to initial values
      }
    }
    loadEmployeeDetails();
  }, [employeeId]);

  return (
    <div className="space-y-6">
      <MonthlyAttendancePayImpact
        employeeId={employeeId === "org" ? undefined : employeeId}
        employeeCode={employeeCode}
        employeeName={employeeName}
        initialSalary={monthlySalary}
        initialWorkingDays={workingDaysInMonth}
      />
    </div>
  );
}
