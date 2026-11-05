"use client";

import React from "react";
import { useAuth } from "@/components/AuthGate";
import { User, Mail, Building, MapPin, Shield } from "lucide-react";

export default function EmployeeProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-emerald-400" />
          Module 2: My Profile
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Personal information, emergency contacts, employment contract, and mapped identity.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-white text-sm">Employment Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-800/40 rounded-lg">
            <span className="text-slate-400">Full Name</span>
            <div className="text-sm font-semibold text-white mt-0.5">{user?.name}</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-lg">
            <span className="text-slate-400">Corporate Email</span>
            <div className="text-sm font-semibold text-white mt-0.5">{user?.email}</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-lg">
            <span className="text-slate-400">Employee ID</span>
            <div className="text-sm font-semibold font-mono text-indigo-400 mt-0.5">{user?.employeeId || "EMP"}</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-lg">
            <span className="text-slate-400">Assigned Roles</span>
            <div className="text-sm font-semibold text-white mt-0.5">{user?.roles.join(", ")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
