import { env } from "../config/env.js";
import { runLoanAutomationTick } from "./loanAutomation.js";

let timer = null;

export function startLoanAutomationScheduler() {
  if (timer) {
    return timer;
  }

  const intervalMs = Math.max(30, Number(env.loanAutomationIntervalSeconds || 60)) * 1000;
  timer = setInterval(() => {
    runLoanAutomationTick().catch((error) => {
      console.error("[loan-scheduler]", error);
    });
  }, intervalMs);

  runLoanAutomationTick().catch((error) => {
    console.error("[loan-scheduler]", error);
  });

  return timer;
}

export function stopLoanAutomationScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
