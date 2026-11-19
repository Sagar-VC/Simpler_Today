import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Single-use MFA recovery codes for test sign-ins.
 *
 * A recovery code works once, so every code handed out is written to a
 * git-ignored ledger in .auth/ and never handed out again. The ledger holds
 * SHA-256 hashes, never the codes themselves.
 *
 * The last `reserve` codes are never handed out: once only those are left, the
 * account still has a way back in for a person who has lost the authenticator.
 *
 * If the server refuses a code, the list is probably stale (codes used by hand,
 * or regenerated). Codes are then paused until the list in .env changes, so
 * repeated runs don't walk through dead codes and lock the account with
 * failed verifications.
 */

const LEDGER_DIR = path.join(__dirname, '..', '.auth');

interface Ledger {
  /** Hashes of the codes already handed out */
  used: string[];
  /** Hash of the code list that had a code refused; codes stay paused while .env holds that list */
  refusedList?: string;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class RecoveryCodes {
  private readonly codes:      string[];
  private readonly listHash:   string;
  private readonly ledgerFile: string;
  readonly reserve: number;

  /**
   * @param list       the codes, comma- or space-separated (from .env)
   * @param ledgerName file name for this account's ledger in .auth/
   * @param reserve    how many codes to always leave unused
   */
  constructor(list: string, ledgerName: string, reserve = 2) {
    this.codes      = list.split(/[\s,]+/).map(code => code.trim().toUpperCase()).filter(Boolean);
    this.listHash   = hash(this.codes.join(','));
    this.ledgerFile = path.join(LEDGER_DIR, `${ledgerName}.json`);
    this.reserve    = reserve;
  }

  private read(): Ledger {
    try {
      const ledger = JSON.parse(fs.readFileSync(this.ledgerFile, 'utf8'));
      return Array.isArray(ledger) ? { used: ledger } : ledger;
    } catch {
      return { used: [] }; // no ledger yet — nothing used
    }
  }

  private write(ledger: Ledger) {
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
    fs.writeFileSync(this.ledgerFile, JSON.stringify(ledger, null, 2));
  }

  /** Codes not handed out yet, the reserve included. */
  remaining(): number {
    const used = new Set(this.read().used);
    return this.codes.filter(code => !used.has(hash(code))).length;
  }

  /** Whether codes are paused because one from the current list was refused. */
  paused(): boolean {
    return this.read().refusedList === this.listHash;
  }

  /** Whether a code can be handed out: not paused, and without touching the reserve. */
  available(): boolean {
    return !this.paused() && this.remaining() > this.reserve;
  }

  /**
   * Hand out the next unused code and record it as used straight away, before
   * it is submitted — a run that crashes mid-sign-in must not reuse it.
   */
  take(): string {
    if (!this.available()) throw new Error('No recovery code available (paused, or only the reserve is left)');
    const ledger = this.read();
    const next   = this.codes.find(code => !ledger.used.includes(hash(code)))!;
    this.write({ ...ledger, used: [...ledger.used, hash(next)] });
    return next;
  }

  /** The server refused a code: pause codes until the list in .env is updated. */
  markRefused() {
    this.write({ ...this.read(), refusedList: this.listHash });
  }
}
