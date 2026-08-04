import { z } from 'zod';

import { isDayString } from './date';
import {
  ACCOUNT_KINDS,
  DEBT_DIRECTIONS,
  INTEREST_KINDS,
  LOAN_INTEREST_MODELS,
  PAYMENT_METHODS,
  TRANSACTION_KINDS,
} from './db/schema';

/** Validation at the server-action boundary. Nothing reaches the ledger unchecked. */

export const dayField = z.string().refine(isDayString, 'Use a real date');

/** Amounts arrive from forms as rupee strings and leave as whole paise. */
export const amountField = z
  .number()
  .int('Amounts are stored in whole paise')
  .positive('Amount has to be more than zero');

const optionalId = z.string().min(1).nullable().optional();

export const transactionInput = z
  .object({
    day: dayField,
    kind: z.enum(TRANSACTION_KINDS),
    amount: amountField,
    accountId: optionalId,
    counterAccountId: optionalId,
    categoryId: optionalId,
    personId: optionalId,
    debtId: optionalId,
    loanId: optionalId,
    installmentId: optionalId,
    interestPart: z.number().int().min(0).default(0),
    method: z.enum(PAYMENT_METHODS).default('upi'),
    note: z.string().max(280).nullable().optional(),
    rawInput: z.string().max(500).nullable().optional(),
  })
  .refine((v) => v.interestPart <= v.amount, {
    message: 'Interest cannot be more than the payment itself',
    path: ['interestPart'],
  })
  .refine((v) => v.kind !== 'transfer' || (v.accountId && v.counterAccountId), {
    message: 'A transfer needs both a source and a destination',
    path: ['counterAccountId'],
  })
  .refine((v) => v.kind !== 'transfer' || v.accountId !== v.counterAccountId, {
    message: 'Pick two different accounts',
    path: ['counterAccountId'],
  });

export type TransactionInput = z.infer<typeof transactionInput>;

export const debtInput = z.object({
  personId: z.string().min(1).nullable(),
  newPersonName: z.string().trim().min(1).max(60).nullable().optional(),
  direction: z.enum(DEBT_DIRECTIONS),
  amount: amountField,
  openedOn: dayField,
  dueOn: dayField.nullable().optional(),
  interestKind: z.enum(INTEREST_KINDS).default('none'),
  ratePctPerMonth: z.number().min(0).max(100).default(0),
  accountId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS).default('upi'),
  note: z.string().max(280).nullable().optional(),
});

export const repaymentInput = z.object({
  debtId: z.string().min(1),
  amount: amountField,
  interestPart: z.number().int().min(0).default(0),
  day: dayField,
  accountId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS).default('upi'),
  note: z.string().max(280).nullable().optional(),
});

export const loanInput = z
  .object({
    lender: z.string().trim().min(1, 'Who lent it to you?').max(60),
    principal: amountField,
    takenOn: dayField,
    tenureMonths: z.number().int().min(1, 'At least one month').max(600),
    interestModel: z.enum(LOAN_INTEREST_MODELS).default('emi_known'),
    emiAmount: z.number().int().min(0).default(0),
    ratePctPerAnnum: z.number().min(0).max(200).default(0),
    processingFee: z.number().int().min(0).default(0),
    firstDueOn: dayField,
    accountId: z.string().min(1),
    /** False when the money never actually landed, e.g. a bill financed directly. */
    recordDisbursal: z.boolean().default(true),
    note: z.string().max(280).nullable().optional(),
  })
  .refine((v) => v.interestModel !== 'emi_known' || v.emiAmount > 0, {
    message: 'Enter the monthly installment you were quoted',
    path: ['emiAmount'],
  });

export const accountInput = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(40),
  kind: z.enum(ACCOUNT_KINDS),
  openingBalance: z.number().int().default(0),
  note: z.string().max(160).nullable().optional(),
});

export const reconcileInput = z.object({
  accountId: z.string().min(1),
  day: dayField,
  actualBalance: z.number().int(),
  note: z.string().max(280).nullable().optional(),
});

export const preferencesInput = z.object({
  horizonDays: z.number().int().min(1).max(365),
  buffer: z.number().int().min(0),
  burnWindowDays: z.number().int().min(1).max(90),
});

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Turns a Zod failure into something a form can render inline. */
export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    fieldErrors[key] ??= issue.message;
  }
  return {
    ok: false,
    error: error.issues[0]?.message ?? 'That does not look right',
    fieldErrors,
  };
}
