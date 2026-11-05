import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { employeeIdConfigs, employees } from "../db/schema";

export interface EmployeeIdRule {
  prefix: string;
  suffix?: string | null;
  digitCount: number;
  nextSequence: number;
  allowManualOverride: boolean;
}

const DEFAULT_RULE: EmployeeIdRule = {
  prefix: "EMP",
  suffix: "",
  digitCount: 3,
  nextSequence: 1,
  allowManualOverride: true,
};

/**
 * Fetches the active Employee ID configuration for an organization.
 */
export async function getEmployeeIdConfig(
  organizationId = "org_mc_global"
): Promise<EmployeeIdRule> {
  const configs = await db
    .select()
    .from(employeeIdConfigs)
    .where(eq(employeeIdConfigs.organizationId, organizationId))
    .limit(1);

  if (configs.length === 0) {
    return DEFAULT_RULE;
  }

  const c = configs[0];
  return {
    prefix: c.prefix,
    suffix: c.suffix || "",
    digitCount: c.digitCount,
    nextSequence: c.nextSequence,
    allowManualOverride: Boolean(c.allowManualOverride),
  };
}

/**
 * Updates the Employee ID configuration for an organization.
 */
export async function updateEmployeeIdConfig(
  organizationId: string,
  newConfig: Partial<EmployeeIdRule>
): Promise<EmployeeIdRule> {
  const current = await getEmployeeIdConfig(organizationId);
  const updated: EmployeeIdRule = {
    ...current,
    ...newConfig,
  };

  await db
    .insert(employeeIdConfigs)
    .values({
      id: `cfg_id_${organizationId}`,
      organizationId,
      prefix: updated.prefix,
      suffix: updated.suffix || null,
      digitCount: updated.digitCount,
      nextSequence: updated.nextSequence,
      allowManualOverride: updated.allowManualOverride,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: employeeIdConfigs.id,
      set: {
        prefix: updated.prefix,
        suffix: updated.suffix || null,
        digitCount: updated.digitCount,
        nextSequence: updated.nextSequence,
        allowManualOverride: updated.allowManualOverride,
        updatedAt: Date.now(),
      },
    });

  return updated;
}

/**
 * Generates the next sequential unique employee ID based on configured rules.
 * Automatically advances sequence and guarantees database uniqueness.
 */
export async function generateNextEmployeeId(
  organizationId = "org_mc_global"
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Fetch current sequence
    const configs = await tx
      .select()
      .from(employeeIdConfigs)
      .where(eq(employeeIdConfigs.organizationId, organizationId))
      .limit(1);

    const config = configs[0] || {
      prefix: DEFAULT_RULE.prefix,
      suffix: DEFAULT_RULE.suffix,
      digitCount: DEFAULT_RULE.digitCount,
      nextSequence: DEFAULT_RULE.nextSequence,
      allowManualOverride: DEFAULT_RULE.allowManualOverride,
    };

    let sequence = config.nextSequence;
    let candidateId = "";
    let isUnique = false;

    // 2. Loop until finding an unused unique ID
    while (!isUnique) {
      const paddedNumber = String(sequence).padStart(config.digitCount, "0");
      candidateId = `${config.prefix}-${paddedNumber}${config.suffix || ""}`;

      const existing = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.employeeCode, candidateId))
        .limit(1);

      if (existing.length === 0) {
        isUnique = true;
      } else {
        sequence++;
      }
    }

    // 3. Increment sequence for next allocation
    await tx
      .insert(employeeIdConfigs)
      .values({
        id: `cfg_id_${organizationId}`,
        organizationId,
        prefix: config.prefix,
        suffix: config.suffix || null,
        digitCount: config.digitCount,
        nextSequence: sequence + 1,
        allowManualOverride: Boolean(config.allowManualOverride),
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: employeeIdConfigs.id,
        set: {
          nextSequence: sequence + 1,
          updatedAt: Date.now(),
        },
      });

    return candidateId;
  });
}

/**
 * Validates a custom or manual employee ID against uniqueness and format rules.
 */
export async function validateEmployeeId(
  candidateId: string,
  excludeEmployeeId?: string
): Promise<{ valid: boolean; error?: string }> {
  if (!candidateId || typeof candidateId !== "string") {
    return { valid: false, error: "Employee ID is required." };
  }

  const trimmed = candidateId.trim().toUpperCase();

  if (trimmed.length < 2 || trimmed.length > 30) {
    return { valid: false, error: "Employee ID must be between 2 and 30 characters." };
  }

  if (!/^[A-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Employee ID may only contain uppercase letters, numbers, hyphens, and underscores.",
    };
  }

  // Check uniqueness in DB
  const existing = await db
    .select({ id: employees.id, employeeCode: employees.employeeCode })
    .from(employees)
    .where(eq(employees.employeeCode, trimmed))
    .limit(1);

  if (existing.length > 0 && existing[0].id !== excludeEmployeeId) {
    return { valid: false, error: `Employee ID "${trimmed}" is already assigned to another employee.` };
  }

  return { valid: true };
}
