#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

function usage() {
  console.error(`Usage:
  npm run readiness:report -- [--env-file .env.local] [--json] [--fail-on critical|warning|never]

Options:
  --env-file   Load environment values before running the report.
  --json       Print machine-readable JSON.
  --fail-on    Exit non-zero for critical issues, warning-or-higher issues, or never. Default: critical.`);
}

function parseFailOn(value) {
  if (value === "critical" || value === "warning" || value === "never") {
    return value;
  }

  usage();
  throw new Error("--fail-on must be critical, warning, or never.");
}

function parseArgs(argv) {
  const args = {
    envFile: "",
    failOn: "critical",
    json: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--env-file") {
      args.envFile = argv[index + 1]?.trim() ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      args.envFile = arg.slice("--env-file=".length).trim();
      continue;
    }

    if (arg === "--fail-on") {
      args.failOn = parseFailOn(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--fail-on=")) {
      args.failOn = parseFailOn(arg.slice("--fail-on=".length));
      continue;
    }

    usage();
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function loadEnvFile(path) {
  if (!path) {
    return;
  }

  if (!existsSync(path)) {
    throw new Error(`Env file does not exist: ${path}`);
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    let value = valueParts.join("=").trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key.trim()] ??= value;
  }
}

function issueCounts(issues) {
  return {
    critical: issues.filter((issue) => issue.status === "critical").length,
    warning: issues.filter((issue) => issue.status === "warning").length
  };
}

function readinessOverallStatus(counts) {
  if (counts.critical > 0) {
    return "critical";
  }

  if (counts.warning > 0) {
    return "warning";
  }

  return "healthy";
}

function shouldFail(failOn, counts) {
  if (failOn === "never") {
    return false;
  }

  if (failOn === "warning") {
    return counts.critical > 0 || counts.warning > 0;
  }

  return counts.critical > 0;
}

function printTextReport(health) {
  const counts = issueCounts(health.productionIssues);
  const overallStatus = readinessOverallStatus(counts);

  console.log("Bouncecore production readiness");
  console.log(`Checked: ${health.checkedAt}`);
  console.log(`Overall: ${overallStatus}`);
  console.log(`Launch attention: ${counts.critical} critical, ${counts.warning} warnings`);
  console.log("");

  if (health.productionIssues.length) {
    console.log("Launch attention");

    for (const issue of health.productionIssues) {
      console.log(`- [${issue.status}] ${issue.groupTitle}: ${issue.label} (${issue.value})`);
      console.log(`  ${issue.detail}`);

      if (issue.href) {
        console.log(`  Repair: ${issue.href}`);
      }
    }

    console.log("");
  }

  console.log("Readiness groups");

  for (const group of health.productionReadiness) {
    const groupCounts = issueCounts(group.items);
    console.log(`- [${group.status}] ${group.title}: ${groupCounts.critical} critical, ${groupCounts.warning} warnings`);
  }
}

const args = parseArgs(process.argv);

try {
  loadEnvFile(args.envFile);

  const [{ getAdminSystemHealthData }, { prisma }] = await Promise.all([
    import("../src/lib/admin/system-health.ts"),
    import("../src/lib/db/prisma.ts")
  ]);
  const health = await getAdminSystemHealthData();
  const counts = issueCounts(health.productionIssues);
  const overallStatus = readinessOverallStatus(counts);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          checkedAt: health.checkedAt,
          groups: health.productionReadiness,
          issueCounts: counts,
          issues: health.productionIssues,
          overallStatus
        },
        null,
        2
      )
    );
  } else {
    printTextReport(health);
  }

  if (shouldFail(args.failOn, counts)) {
    process.exitCode = 1;
  }

  await prisma.$disconnect();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Readiness report failed.");
  process.exitCode = 1;
}
