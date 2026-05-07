const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export const haptics = {
  light: () => canVibrate && navigator.vibrate(10),
  medium: () => canVibrate && navigator.vibrate(20),
  heavy: () => canVibrate && navigator.vibrate([0, 30, 10, 30]),
  success: () => canVibrate && navigator.vibrate([10, 50, 10]),
  error: () => canVibrate && navigator.vibrate([30, 20, 30, 20, 30]),
  tap: () => canVibrate && navigator.vibrate(8),
};
