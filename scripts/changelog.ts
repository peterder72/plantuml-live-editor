import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ChangelogRelease {
  version: string;
  changes: string[];
}

export interface Changelog {
  schemaVersion: 1;
  releases: ChangelogRelease[];
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export async function loadChangelog(): Promise<Changelog> {
  const text = await readFile(resolve("CHANGELOG.json"), "utf8");
  return parseChangelog(JSON.parse(text));
}

export function parseChangelog(value: unknown): Changelog {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("CHANGELOG.json must use schemaVersion 1.");
  }
  if (!Array.isArray(value.releases) || value.releases.length === 0) {
    throw new Error("CHANGELOG.json must contain at least one release.");
  }

  const versions = new Set<string>();
  const releases = value.releases.map((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.version !== "string") {
      throw new Error(`Changelog release ${index + 1} has no version.`);
    }
    if (!SEMVER_PATTERN.test(candidate.version)) {
      throw new Error(`Changelog version ${candidate.version} is not valid semver.`);
    }
    if (versions.has(candidate.version)) {
      throw new Error(`Changelog version ${candidate.version} is duplicated.`);
    }
    if (
      !Array.isArray(candidate.changes) ||
      candidate.changes.length === 0 ||
      candidate.changes.some(
        (change) => typeof change !== "string" || change.trim().length === 0,
      )
    ) {
      throw new Error(
        `Changelog version ${candidate.version} must contain non-empty changes.`,
      );
    }
    versions.add(candidate.version);
    return {
      version: candidate.version,
      changes: candidate.changes as string[],
    };
  });

  return { schemaVersion: 1, releases };
}

export function renderChangelogMarkdown(changelog: Changelog) {
  const releases = changelog.releases
    .map(
      ({ version, changes }) =>
        `## ${version}\n\n${changes.map((change) => `- ${change}`).join("\n")}`,
    )
    .join("\n\n");
  return `# Changelog\n\n${releases}\n`;
}

export function renderReleaseNotesMarkdown(
  changelog: Changelog,
  version: string,
) {
  const release = changelog.releases.find(
    (candidate) => candidate.version === version,
  );
  if (!release) {
    throw new Error(`CHANGELOG.json has no entry for version ${version}.`);
  }
  return `## Changes in ${version}\n\n${release.changes
    .map((change) => `- ${change}`)
    .join("\n")}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
