import { createDemoReport } from "./demo-support";

async function main() {
  const report = await createDemoReport();
  console.log("Deterministic demo report:");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
