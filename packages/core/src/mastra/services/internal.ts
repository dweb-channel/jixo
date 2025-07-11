import {createHash} from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";

export const EMPTY_JOB_CONTENT = `---
title: _undefined_
progress: '0%'
---

## Roadmap

## Work Log

`;

/**
 * Gets the full path for a job's log file.
 * @param workspaceDir The root directory of the workspace.
 * @param jobName The name of the job.
 * @returns The absolute path to the log file.
 */
export function getLogFilePath(workspaceDir: string, jobName: string): string {
  return path.join(workspaceDir, ".jixo", `${jobName}.log.md`);
}

/**
 * Gets the full path for a cached log file based on its content hash.
 * @param workspaceDir The root directory of the workspace.
 * @param hash The SHA256 hash of the log file's content.
 * @returns The absolute path to the cache file.
 */
export function getCacheFilePath(workspaceDir: string, hash: string): string {
  return path.join(workspaceDir, ".jixo/cache", `${hash}.json`);
}

/**
 * Ensures the necessary JIXO directories exist.
 */
export async function ensureJixoDirsExist(workspaceDir: string): Promise<void> {
  await fsp.mkdir(path.join(workspaceDir, ".jixo/cache"), {recursive: true});
}

export const calcContentHash = (content: string) => {
  return createHash("sha256").update(content).digest("hex");
};
