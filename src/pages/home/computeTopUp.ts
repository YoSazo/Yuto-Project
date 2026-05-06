import { fetchYutoBalance } from "../../lib/supabase";

export const MIN_MPESA_TOPUP_KES = 20;

/** Gap to cover via M-PESA when join fails — uses RPC `(have …, need …)` if present, else wallet balance vs share */
export async function computeFunctionTopUpGapKes(opts: {
  shareKes: number;
  rpcErrorMessage?: string | null;
  userId: string;
}): Promise<number> {
  const share = Math.max(0, Math.ceil(Number(opts.shareKes) || 0));
  const msg = opts.rpcErrorMessage ?? "";
  const m = msg.match(/have\s+([\d.]+)\s*,?\s*need\s+([\d.]+)/i);
  if (m) {
    const have = parseFloat(m[1]) || 0;
    const need = parseFloat(m[2]) || share;
    return Math.max(MIN_MPESA_TOPUP_KES, Math.ceil(need - have));
  }
  const bal = await fetchYutoBalance(opts.userId);
  const gap = Math.ceil(share - bal);
  if (gap > 0) return Math.max(MIN_MPESA_TOPUP_KES, gap);
  return Math.max(MIN_MPESA_TOPUP_KES, share);
}
