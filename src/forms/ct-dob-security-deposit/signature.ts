// The signature on page 2 (CLAUDE.md §14): drawn by default, or a typed
// "/s/ {name}" for people who can't draw one. Only the selected method counts.

import type { DepositComplaintState } from './schema.ts';

type Signature = DepositComplaintState['signature'];

export function hasSignature(signature: Signature): boolean {
  return signature.method === 'typed'
    ? signature.typedName.trim() !== ''
    : signature.pngDataUrl !== null;
}

/** What a typed signature prints on the signature line. */
export const typedSignatureText = (name: string) => `/s/ ${name.trim().replace(/\s+/g, ' ')}`;
