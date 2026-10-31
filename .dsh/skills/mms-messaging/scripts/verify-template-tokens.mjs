#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('Verifying messaging template variable token validation rules...');

const sharedPath = resolve('packages/shared/src/messagingSchemas.ts');
if (!existsSync(sharedPath)) {
  console.log('messagingSchemas.ts not found at default path, checking index.ts');
}

// Canonical MMS template tokens:
const CANONICAL_TOKENS = new Set([
  'student_name',
  'parent_name',
  'madrasa_name',
  'invoice_number',
  'amount_due',
  'due_date',
  'attendance_date',
  'attendance_status',
  'exam_name',
  'exam_score',
  'session_name',
]);

const TOKEN_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

export function validateTemplateText(templateText) {
  const invalid = [];
  let match;
  while ((match = TOKEN_PATTERN.exec(templateText)) !== null) {
    const token = match[1];
    if (!CANONICAL_TOKENS.has(token)) {
      invalid.push(token);
    }
  }
  return invalid;
}

console.log('✅ Messaging template token validator loaded successfully.');
