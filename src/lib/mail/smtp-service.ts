import net from "node:net";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

type SmtpConfig = {
  from: string;
  fromName: string;
  host: string;
  password: string;
  port: number;
  replyTo: string | null;
  secure: boolean;
  username: string;
};

export type MailMessage = {
  html?: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  to: string | string[];
};

export type MailSendResult =
  | {
      configured: true;
      messageId: string;
      sent: true;
    }
  | {
      configured: false;
      reason: string;
      sent: false;
    };

const smtpTimeoutMs = 15000;

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function smtpConfig(): SmtpConfig | null {
  const username = envValue("BREVO_SMTP_USER", "SMTP_USER");
  const password = envValue("BREVO_SMTP_KEY", "BREVO_SMTP_PASSWORD", "SMTP_PASSWORD");
  const from = envValue("MAIL_FROM", "BREVO_SMTP_FROM", "SMTP_FROM");

  if (!username || !password || !from) {
    return null;
  }

  const port = Number(envValue("BREVO_SMTP_PORT", "SMTP_PORT") || "587");
  const secureValue = envValue("BREVO_SMTP_SECURE", "SMTP_SECURE").toLowerCase();

  return {
    from,
    fromName: envValue("MAIL_FROM_NAME", "SMTP_FROM_NAME") || "Bouncecore",
    host: envValue("BREVO_SMTP_HOST", "SMTP_HOST") || "smtp-relay.brevo.com",
    password,
    port: Number.isFinite(port) ? port : 587,
    replyTo: envValue("MAIL_REPLY_TO", "SMTP_REPLY_TO") || null,
    secure: secureValue ? ["1", "true", "yes", "ssl"].includes(secureValue) : port === 465,
    username
  };
}

function normalizeRecipients(value: string | string[]) {
  return (Array.isArray(value) ? value : [value])
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function encodeHeader(value: string) {
  const clean = value.replace(/[\r\n]+/g, " ").trim();

  return /[^\x20-\x7e]/.test(clean) ? `=?UTF-8?B?${Buffer.from(clean).toString("base64")}?=` : clean;
}

function formatAddress(email: string, name?: string) {
  const cleanEmail = email.replace(/[<>\r\n"]/g, "").trim();
  const cleanName = name?.replace(/[\r\n"]+/g, " ").trim();

  return cleanName ? `"${cleanName}" <${cleanEmail}>` : cleanEmail;
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMessage(config: SmtpConfig, input: MailMessage, messageId: string, recipients: string[]) {
  const boundary = `bouncecore-${randomUUID()}`;
  const headers = [
    `From: ${formatAddress(config.from, config.fromName)}`,
    `To: ${recipients.map((recipient) => formatAddress(recipient)).join(", ")}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@bouncecore.local>`,
    "MIME-Version: 1.0"
  ];
  const replyTo = input.replyTo ?? config.replyTo;

  if (replyTo) {
    headers.push(`Reply-To: ${formatAddress(replyTo)}`);
  }

  if (!input.html) {
    return `${headers.join("\r\n")}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(
      input.text
    )}\r\n`;
  }

  return `${headers.join("\r\n")}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(
    input.text
  )}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(
    input.html
  )}\r\n--${boundary}--\r\n`;
}

class SmtpSession {
  private buffer = "";
  private socket: net.Socket | tls.TLSSocket | null = null;

  constructor(private readonly config: SmtpConfig) {}

  async connect() {
    this.socket = await new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      const socket = this.config.secure
        ? tls.connect({
            host: this.config.host,
            port: this.config.port,
            servername: this.config.host,
            timeout: smtpTimeoutMs
          })
        : net.connect({
            host: this.config.host,
            port: this.config.port,
            timeout: smtpTimeoutMs
          });

      socket.once("error", onError);
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("SMTP connection timed out."));
      });
      socket.once(this.config.secure ? "secureConnect" : "connect", () => {
        socket.off("error", onError);
        resolve(socket);
      });
    });

    await this.expect([220]);
  }

  async startTlsIfNeeded() {
    if (this.config.secure) {
      return;
    }

    const ehlo = await this.command(`EHLO ${this.localHostname()}`, [250]);

    if (!ehlo.toUpperCase().includes("STARTTLS")) {
      return;
    }

    await this.command("STARTTLS", [220]);
    this.socket = tls.connect({
      socket: this.socket as net.Socket,
      servername: this.config.host
    });
    await new Promise<void>((resolve, reject) => {
      this.socket?.once("secureConnect", resolve);
      this.socket?.once("error", reject);
    });
    this.buffer = "";
  }

  async login() {
    await this.command(`EHLO ${this.localHostname()}`, [250]);
    await this.command("AUTH LOGIN", [334]);
    await this.command(Buffer.from(this.config.username).toString("base64"), [334]);
    await this.command(Buffer.from(this.config.password).toString("base64"), [235]);
  }

  async send(input: MailMessage) {
    const recipients = normalizeRecipients(input.to);

    if (!recipients.length) {
      throw new Error("Email needs at least one recipient.");
    }

    const messageId = randomUUID();

    await this.command(`MAIL FROM:<${this.config.from}>`, [250]);

    for (const recipient of recipients) {
      await this.command(`RCPT TO:<${recipient}>`, [250, 251]);
    }

    await this.command("DATA", [354]);
    await this.command(`${buildMessage(this.config, input, messageId, recipients)}\r\n.`, [250]);

    return messageId;
  }

  async quit() {
    if (!this.socket || this.socket.destroyed) {
      return;
    }

    await this.command("QUIT", [221]).catch(() => {
      // The relay can close immediately after accepting QUIT.
    });
    this.socket.end();
  }

  private localHostname() {
    return process.env.SMTP_HELO_HOST?.trim() || "bouncecore.local";
  }

  private async command(command: string, expectedCodes: number[]) {
    this.write(`${command}\r\n`);

    return this.expect(expectedCodes);
  }

  private write(value: string) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("SMTP socket is not connected.");
    }

    this.socket.write(value);
  }

  private expect(expectedCodes: number[]) {
    return new Promise<string>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("SMTP socket is not connected."));
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("SMTP response timed out."));
      }, smtpTimeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket?.off("data", onData);
        this.socket?.off("error", onError);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");

        const lines = this.buffer.split(/\r?\n/);
        const lastCompleteLine = lines.at(-2);

        if (!lastCompleteLine || !/^\d{3} /.test(lastCompleteLine)) {
          return;
        }

        const response = lines.slice(0, -1).join("\n");
        const code = Number(lastCompleteLine.slice(0, 3));
        this.buffer = lines.at(-1) ?? "";
        cleanup();

        if (!expectedCodes.includes(code)) {
          reject(new Error(`SMTP command failed with ${code}: ${response}`));
          return;
        }

        resolve(response);
      };

      this.socket.on("data", onData);
      this.socket.once("error", onError);
    });
  }
}

export async function sendMail(input: MailMessage): Promise<MailSendResult> {
  const config = smtpConfig();

  if (!config) {
    return {
      configured: false,
      reason: "SMTP is not configured.",
      sent: false
    };
  }

  const session = new SmtpSession(config);

  await session.connect();

  try {
    await session.startTlsIfNeeded();
    await session.login();
    const messageId = await session.send(input);

    return {
      configured: true,
      messageId,
      sent: true
    };
  } finally {
    await session.quit();
  }
}

export function mailIsConfigured() {
  return Boolean(smtpConfig());
}
