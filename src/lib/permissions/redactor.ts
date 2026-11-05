import { SENSITIVE_PERMISSIONS, SessionContext } from "./types";
import { hasPermission } from "./evaluator";

export interface RawSensitiveEmployee {
  id: string;
  employeeId: string;
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  taxIdentifier: string;
  identityDocumentNumber: string;
  identityDocumentUrl: string;
  [key: string]: any;
}

export interface RedactedSensitiveEmployee {
  id: string;
  employeeId: string;
  basicSalary: number | string;
  grossSalary: number | string;
  netSalary: number | string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  taxIdentifier: string;
  identityDocumentNumber: string;
  identityDocumentUrl: string;
  [key: string]: any;
}

/**
 * Sanitizes and redacts sensitive employee fields based on session permissions.
 */
export function redactSensitiveDetails(
  details: RawSensitiveEmployee,
  context: SessionContext
): RedactedSensitiveEmployee {
  const canReadSalary = hasPermission(context, SENSITIVE_PERMISSIONS.SALARY_READ);
  const canReadBank = hasPermission(context, SENSITIVE_PERMISSIONS.BANK_READ);
  const canReadTax = hasPermission(context, SENSITIVE_PERMISSIONS.TAX_READ);
  const canReadIdentity = hasPermission(context, SENSITIVE_PERMISSIONS.IDENTITY_READ);

  return {
    ...details,
    basicSalary: canReadSalary ? details.basicSalary : "••••••••",
    grossSalary: canReadSalary ? details.grossSalary : "••••••••",
    netSalary: canReadSalary ? details.netSalary : "••••••••",
    bankName: canReadBank ? details.bankName : "••••••••",
    bankAccountNumber: canReadBank
      ? details.bankAccountNumber
      : `•••• ${details.bankAccountNumber.slice(-4) || "••••"}`,
    bankIfsc: canReadBank ? details.bankIfsc : "••••••••",
    taxIdentifier: canReadTax ? details.taxIdentifier : "••••••••",
    identityDocumentNumber: canReadIdentity
      ? details.identityDocumentNumber
      : `•••• ${details.identityDocumentNumber.slice(-4) || "••••"}`,
    identityDocumentUrl: canReadIdentity ? details.identityDocumentUrl : "[RESTRICTED]",
  };
}
