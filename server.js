import "dotenv/config";
import app from "./app.js";
import { getPort, validateProductionEnvironment } from "./config/env.js";
import { startNotificationWorker, stopNotificationWorker } from "./services/notificationWorker.js";
import { prisma } from "./services/prisma.js";

validateProductionEnvironment();

const port = getPort();
const server = app.listen(port, () => {
  console.log(`MedTravia API is listening on port ${port}`);
  startNotificationWorker();
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  const workerStopped = stopNotificationWorker();

  server.close(async () => {
    try {
      await workerStopped;
      await prisma.$disconnect();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error("Graceful shutdown failed", { error: error.message });
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
