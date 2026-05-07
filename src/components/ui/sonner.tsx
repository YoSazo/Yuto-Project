import { Toaster as Sonner } from "sonner";

/** Sonner toasts — import `toast` from `"sonner"` in feature code. */
export function Toaster() {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      richColors
      closeButton
    />
  );
}
