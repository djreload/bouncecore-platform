import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import sharp from "sharp";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  createEmptyCoreLevelDocument,
  normalizeCoreLevelDocument,
  normalizeCoreLevelSlug,
  validateCoreLevelDocument,
  type CoreLevelDocument,
  type CoreLevelValidationResult
} from "@/lib/games/core-level-builder-core";

const settingKey = "games.core-fps.level-projects";
const maximumProjects = 30;
const maximumPreviewBytes = 8 * 1024 * 1024;

export type CoreLevelProjectStatus = "draft" | "published";

export type CoreLevelProject = {
  createdAt: string;
  createdById: string;
  description: string;
  document: CoreLevelDocument;
  id: string;
  name: string;
  previewUrl: string | null;
  publishedAt: string | null;
  publishedDefinitionUrl: string | null;
  publishedVersion: number;
  slug: string;
  status: CoreLevelProjectStatus;
  updatedAt: string;
};

type StoredCoreLevelCatalog = {
  projects: CoreLevelProject[];
};

export type SaveCoreLevelProjectInput = {
  description?: unknown;
  document: unknown;
  name?: unknown;
  projectId?: unknown;
};

export type PublishCoreLevelProjectInput = {
  document: unknown;
  previewDataUrl?: unknown;
  projectId: unknown;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeDate(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function safeProjectId(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9_-]{8,80}$/.test(text) ? text : null;
}

function safeDescription(value: unknown, fallback = "") {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, 500);
}

function normalizeStoredProject(value: unknown): CoreLevelProject | null {
  const record = recordValue(value);
  const id = safeProjectId(record?.id);

  if (!record || !id) {
    return null;
  }

  const now = new Date().toISOString();
  const document = normalizeCoreLevelDocument(record.document);
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim().replace(/\s+/g, " ").slice(0, 60)
      : document.name;
  const slug = normalizeCoreLevelSlug(record.slug ?? document.slug ?? name);
  const status: CoreLevelProjectStatus = record.status === "published" ? "published" : "draft";
  const previewUrl =
    typeof record.previewUrl === "string" &&
    /^\/uploads\/core-levels\/bc-[a-z0-9-]+\/v\d+\/preview\.webp$/.test(record.previewUrl)
      ? record.previewUrl
      : null;
  const publishedDefinitionUrl =
    typeof record.publishedDefinitionUrl === "string" &&
    /^\/uploads\/core-levels\/bc-[a-z0-9-]+\/v\d+\/level\.json$/.test(record.publishedDefinitionUrl)
      ? record.publishedDefinitionUrl
      : null;

  return {
    createdAt: safeDate(record.createdAt, now),
    createdById:
      typeof record.createdById === "string" ? record.createdById.slice(0, 80) : "unknown",
    description: safeDescription(record.description, document.description),
    document: {
      ...document,
      description: safeDescription(record.description, document.description),
      name,
      slug
    },
    id,
    name,
    previewUrl,
    publishedAt: status === "published" ? safeDate(record.publishedAt, now) : null,
    publishedDefinitionUrl,
    publishedVersion: Math.max(0, Math.round(Number(record.publishedVersion) || 0)),
    slug,
    status,
    updatedAt: safeDate(record.updatedAt, now)
  };
}

function normalizeCatalog(value: unknown): StoredCoreLevelCatalog {
  const record = recordValue(value);
  const projects = Array.isArray(record?.projects)
    ? record.projects
        .map(normalizeStoredProject)
        .filter((project): project is CoreLevelProject => Boolean(project))
        .slice(0, maximumProjects)
    : [];

  return {
    projects: [...new Map(projects.map((project) => [project.id, project])).values()]
  };
}

async function readCatalog() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: settingKey
    }
  });

  return normalizeCatalog(setting?.value);
}

async function writeCatalog(catalog: StoredCoreLevelCatalog) {
  const normalized = normalizeCatalog(catalog);

  await prisma.appSetting.upsert({
    where: {
      key: settingKey
    },
    update: {
      description: "Admin-authored Core FPS level projects and immutable published definitions.",
      isSecret: false,
      value: normalized as unknown as Prisma.InputJsonValue
    },
    create: {
      description: "Admin-authored Core FPS level projects and immutable published definitions.",
      isSecret: false,
      key: settingKey,
      value: normalized as unknown as Prisma.InputJsonValue
    }
  });

  return normalized;
}

function projectSummary(project: CoreLevelProject) {
  const validation = validateCoreLevelDocument(project.document);
  return {
    createdAt: project.createdAt,
    description: project.description,
    id: project.id,
    name: project.name,
    objectCount: project.document.objects.length,
    previewUrl: project.previewUrl,
    publishedAt: project.publishedAt,
    publishedDefinitionUrl: project.publishedDefinitionUrl,
    publishedVersion: project.publishedVersion,
    slug: project.slug,
    status: project.status,
    updatedAt: project.updatedAt,
    validation
  };
}

export async function getAdminCoreLevelBuilderData(projectId?: string | null) {
  const catalog = await readCatalog();
  const requestedProject =
    catalog.projects.find((project) => project.id === projectId) ??
    catalog.projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ??
    null;

  return {
    activeProject: requestedProject,
    projects: catalog.projects
      .map(projectSummary)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  };
}

export async function saveCoreLevelProject(input: SaveCoreLevelProjectInput, actorId: string) {
  const catalog = await readCatalog();
  const requestedId = safeProjectId(input.projectId);
  const existing = requestedId
    ? catalog.projects.find((project) => project.id === requestedId) ?? null
    : null;

  if (!existing && catalog.projects.length >= maximumProjects) {
    throw new Error(`A maximum of ${maximumProjects} Core level projects can be stored.`);
  }

  const document = normalizeCoreLevelDocument(input.document);
  const requestedName =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().replace(/\s+/g, " ").slice(0, 60)
      : document.name;
  const description = safeDescription(input.description, document.description);
  const now = new Date().toISOString();
  const slug = existing?.slug ?? normalizeCoreLevelSlug(document.slug || requestedName);
  const project: CoreLevelProject = {
    createdAt: existing?.createdAt ?? now,
    createdById: existing?.createdById ?? actorId,
    description,
    document: {
      ...document,
      description,
      name: requestedName,
      slug
    },
    id: existing?.id ?? `core-level-${randomUUID()}`,
    name: requestedName,
    previewUrl: existing?.previewUrl ?? null,
    publishedAt: existing?.publishedAt ?? null,
    publishedDefinitionUrl: existing?.publishedDefinitionUrl ?? null,
    publishedVersion: existing?.publishedVersion ?? 0,
    slug,
    status: "draft",
    updatedAt: now
  };
  const nextProjects = existing
    ? catalog.projects.map((candidate) => (candidate.id === project.id ? project : candidate))
    : [project, ...catalog.projects];

  await writeCatalog({ projects: nextProjects });
  await writeAuditLog({
    actorId,
    action: existing ? "games.core-fps.level.update" : "games.core-fps.level.create",
    target: `core-level:${project.id}`,
    metadata: {
      modes: project.document.modes,
      objectCount: project.document.objects.length,
      slug: project.slug
    }
  });

  return {
    project,
    summary: projectSummary(project)
  };
}

export async function deleteCoreLevelProject(projectId: unknown, actorId: string) {
  const id = safeProjectId(projectId);

  if (!id) {
    throw new Error("Choose a valid Core level project.");
  }

  const catalog = await readCatalog();
  const project = catalog.projects.find((candidate) => candidate.id === id);

  if (!project) {
    throw new Error("That Core level project no longer exists.");
  }

  await writeCatalog({
    projects: catalog.projects.filter((candidate) => candidate.id !== id)
  });
  await writeAuditLog({
    actorId,
    action: "games.core-fps.level.delete",
    target: `core-level:${project.id}`,
    severity: project.status === "published" ? "warning" : "info",
    metadata: {
      publishedVersion: project.publishedVersion,
      slug: project.slug
    }
  });

  return project;
}

function previewBuffer(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^data:image\/(?:png|webp);base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) {
    return null;
  }

  const buffer = Buffer.from(match[1], "base64");
  return buffer.length > 0 && buffer.length <= maximumPreviewBytes ? buffer : null;
}

async function writePublishedFiles(
  project: CoreLevelProject,
  document: CoreLevelDocument,
  version: number,
  previewDataUrl: unknown,
  validation: CoreLevelValidationResult
) {
  const relativeDirectory = path.join("uploads", "core-levels", project.slug, `v${version}`);
  const outputDirectory = path.join(process.cwd(), "public", relativeDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const definition = {
    compiler: {
      coordinateSystem: "cube2-z-up",
      gridSize: document.gridSize,
      target: "djreload/core",
      worldSize: document.worldSize
    },
    document,
    map: {
      description: project.description,
      displayName: project.name,
      id: project.slug,
      modes: document.modes,
      version
    },
    publishedAt: new Date().toISOString(),
    validation: validation.stats
  };
  const definitionPath = path.join(outputDirectory, "level.json");
  await writeFile(definitionPath, `${JSON.stringify(definition, null, 2)}\n`, "utf8");

  let previewUrl: string | null = project.previewUrl;
  const sourcePreview = previewBuffer(previewDataUrl);
  if (sourcePreview) {
    await sharp(sourcePreview, { limitInputPixels: 32_000_000 })
      .resize(1280, 720, { fit: "cover", position: "centre" })
      .webp({ effort: 5, quality: 88 })
      .toFile(path.join(outputDirectory, "preview.webp"));
    previewUrl = `/${relativeDirectory.replaceAll("\\", "/")}/preview.webp`;
  }

  return {
    definitionUrl: `/${relativeDirectory.replaceAll("\\", "/")}/level.json`,
    previewUrl
  };
}

export async function publishCoreLevelProject(
  input: PublishCoreLevelProjectInput,
  actorId: string
) {
  const id = safeProjectId(input.projectId);

  if (!id) {
    throw new Error("Choose a valid Core level project.");
  }

  const catalog = await readCatalog();
  const existing = catalog.projects.find((candidate) => candidate.id === id);

  if (!existing) {
    throw new Error("Save this Core level project before publishing it.");
  }

  const document = normalizeCoreLevelDocument(input.document);
  const validation = validateCoreLevelDocument(document);
  if (!validation.valid) {
    const firstError = validation.issues.find((issue) => issue.severity === "error");
    throw new Error(firstError?.message ?? "Fix the level validation errors before publishing.");
  }

  const version = existing.publishedVersion + 1;
  const publishedFiles = await writePublishedFiles(
    existing,
    document,
    version,
    input.previewDataUrl,
    validation
  );
  const now = new Date().toISOString();
  const project: CoreLevelProject = {
    ...existing,
    description: document.description,
    document,
    name: document.name,
    previewUrl: publishedFiles.previewUrl,
    publishedAt: now,
    publishedDefinitionUrl: publishedFiles.definitionUrl,
    publishedVersion: version,
    status: "published",
    updatedAt: now
  };

  await writeCatalog({
    projects: catalog.projects.map((candidate) =>
      candidate.id === project.id ? project : candidate
    )
  });
  await writeAuditLog({
    actorId,
    action: "games.core-fps.level.publish",
    target: `core-level:${project.id}`,
    severity: "warning",
    metadata: {
      definitionUrl: project.publishedDefinitionUrl,
      modes: document.modes,
      objectCount: document.objects.length,
      slug: project.slug,
      version
    }
  });

  return {
    project,
    summary: projectSummary(project),
    validation
  };
}

export function newCoreLevelProjectDocument() {
  return createEmptyCoreLevelDocument();
}
