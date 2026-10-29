import { getNotificationWorkerConfig } from "../config/env.js";
import { processNextInquiryNotification } from "./inquiryService.js";

let timer = null;
let activeRun = null;
let stopped = true;

async function runBatch() {
  for (let processed = 0; processed < 10; processed += 1) {
    const result = await processNextInquiryNotification();
    if (!result) break;
  }
}

function schedule(delay) {
  if (stopped) return;
  timer = setTimeout(tick, delay);
  timer.unref();
}

async function tick() {
  if (stopped || activeRun) return;
  activeRun = runBatch();
  try {
    await activeRun;
  } catch (error) {
    console.error("Notification worker cycle failed", { error: error.message });
  } finally {
    activeRun = null;
    schedule(getNotificationWorkerConfig().pollIntervalMs);
  }
}

export function startNotificationWorker() {
  if (!stopped) return;
  stopped = false;
  schedule(0);
}

export async function stopNotificationWorker() {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
  if (activeRun) await activeRun.catch(() => {});
}
