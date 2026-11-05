"use client";

import React, { useEffect, useState } from "react";
import { Users, Shield, Building, MapPin, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthGate";

export default function AdminEmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/payrol/api/employees")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setEmployees(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Module 2: Employee Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Scoped employee records enforced server-side via Turso DAL (Scope:{" "}
            <span className="text-indigo-400 font-mono font-semibold">{user?.widestScope}</span>)
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Loading scoped employees from Turso...</span>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Name & Email</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono font-medium text-indigo-400">
                      {emp.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{emp.name}</div>
                      <div className="text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {emp.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">{emp.jobTitle}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        <Building className="w-3 h-3 text-slate-400" />
                        {emp.departmentName || "General"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3 h-3" />
                        {emp.locationName || "HQ"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

