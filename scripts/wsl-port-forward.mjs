import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import net from "node:net";

const options = {
  distro: "Debian",
  host: "127.0.0.1",
  pidFile: ".codex-run/wsl-port-forward.pid",
  ports: [1935, 1936],
  target: ""
};

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  const value = process.argv[index + 1];

  if (arg === "--distro" && value) {
    options.distro = value;
    index += 1;
  } else if (arg === "--host" && value) {
    options.host = value;
    index += 1;
  } else if (arg === "--pid-file" && value) {
    options.pidFile = value;
    index += 1;
  } else if (arg === "--ports" && value) {
    options.ports = value
      .split(",")
      .map((port) => Number(port.trim()))
      .filter((port) => Number.isInteger(port) && port > 0);
    index += 1;
  } else if (arg === "--target" && value) {
    options.target = value;
    index += 1;
  }
}

function getWslAddress() {
  const raw = execFileSync("wsl.exe", ["-d", options.distro, "--", "hostname", "-I"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const address = raw
    .split(/\s+/)
    .find((candidate) => /^\d+\.\d+\.\d+\.\d+$/.test(candidate) && candidate !== "172.17.0.1");

  if (!address) {
    throw new Error(`No usable WSL IPv4 address was found for ${options.distro}.`);
  }

  return address;
}

const target = options.target || getWslAddress();

mkdirSync(dirname(options.pidFile), { recursive: true });
writeFileSync(options.pidFile, `${process.pid}\n`);

for (const port of options.ports) {
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: target, port });

    client.pipe(upstream);
    upstream.pipe(client);

    const close = () => {
      client.destroy();
      upstream.destroy();
    };

    client.on("error", close);
    upstream.on("error", close);
    client.on("close", close);
    upstream.on("close", close);
  });

  server.on("error", (error) => {
    console.error(`Port forward ${options.host}:${port} -> ${target}:${port} failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen({ host: options.host, port }, () => {
    console.log(`Forwarding ${options.host}:${port} -> ${target}:${port}`);
  });
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
