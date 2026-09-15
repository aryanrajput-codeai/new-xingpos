/**
 * QZ Tray Integration Service
 * Re-exports the unified singleton from ./qzTray
 */
export {
  QZTrayService,
  QZTrayOfflineError,
  qzTray,
  printCustomerBillDirect,
  buildCustomerBillESCPOS,
  default,
} from "./qzTray";

export type {
  QZTrayStatus,
  QZTrayConnectionStatus,
  DirectPrintResult,
} from "./qzTray";
