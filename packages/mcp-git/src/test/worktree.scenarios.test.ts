import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {type SimpleGit} from "simple-git";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

describe("MCP Git Tools - Worktree Scenarios", () => {
  let sandboxPath: string;
  let mainRepoPath: string;
  let git: SimpleGit;

  beforeEach(async () => {
    mock.restoreAll();
    const setup = setupSandbox();
    sandboxPath = setup.sandboxPath;
    const repo = await setup.initRepo();
    mainRepoPath = repo.repoPath;
    git = repo.git;

    fs.writeFileSync(path.join(mainRepoPath, "main.txt"), "main content");
    await git.add("main.txt").commit("Initial commit");
  });

  afterEach(() => {
    cleanupSandbox(sandboxPath);
  });

  test("should handle the full worktree lifecycle with successful merge", async () => {
    const worktreeAdd = getToolHandler("git_worktree_add");
    const worktreeList = getToolHandler("git_worktree_list");
    const worktreeRemove = getToolHandler("git_worktree_remove");
    const add = getToolHandler("git_add");
    const commit = getToolHandler("git_commit");
    const merge = getToolHandler("git_merge");

    const featureWorktreePath = path.join(sandboxPath, "feature-branch-worktree");

    const addResult = await worktreeAdd({
      repoPath: mainRepoPath,
      path: featureWorktreePath,
      branch: "feature/new-feature",
      createBranch: true,
    });
    assert.ok(addResult.structuredContent.success, `Worktree add failed: ${!addResult.structuredContent.success && JSON.stringify(addResult.structuredContent.error)}`);
    assert.ok(fs.existsSync(featureWorktreePath), "Worktree directory should be created");

    const listResult = await worktreeList({repoPath: mainRepoPath});
    assert.ok(listResult.structuredContent.success);
    const worktrees = listResult.structuredContent.result.worktrees;
    assert.strictEqual(worktrees.length, 2, "Should be two worktrees (main and feature)");
    const featureWorktreeInfo = worktrees.find((w) => w.path === fs.realpathSync(featureWorktreePath));
    assert.ok(featureWorktreeInfo, "Feature worktree should be in the list");
    assert.strictEqual(featureWorktreeInfo.branch, "feature/new-feature");

    fs.writeFileSync(path.join(featureWorktreePath, "feature.txt"), "feature content");
    await add({repoPath: featureWorktreePath, files: ["feature.txt"]});
    await commit({repoPath: featureWorktreePath, message: "Implement new feature"});

    await git.checkout("main");
    const mergeResult = await merge({repoPath: mainRepoPath, branch: "feature/new-feature"});
    assert.ok(mergeResult.structuredContent.success, "Merge should be successful");

    const log = await git.log();
    assert.match(log.latest!.message, /Implement new feature/);

    await worktreeRemove({repoPath: mainRepoPath, path: featureWorktreePath});

    const finalListResult = await worktreeList({repoPath: mainRepoPath});
    assert.ok(finalListResult.structuredContent.success);
    assert.strictEqual(finalListResult.structuredContent.result.worktrees.length, 1, "Worktree list should have 1 entry after removal");
  });

  test("should handle merge conflicts gracefully", async () => {
    const worktreeAdd = getToolHandler("git_worktree_add");
    const add = getToolHandler("git_add");
    const commit = getToolHandler("git_commit");
    const merge = getToolHandler("git_merge");

    const featureWorktreePath = path.join(sandboxPath, "conflict-worktree");

    await worktreeAdd({
      repoPath: mainRepoPath,
      path: featureWorktreePath,
      branch: "feature/conflict",
      createBranch: true,
    });

    // Create a conflict
    fs.writeFileSync(path.join(mainRepoPath, "main.txt"), "main change");
    await git.add("main.txt").commit("Update main in main branch");

    fs.writeFileSync(path.join(featureWorktreePath, "main.txt"), "feature change");
    await add({repoPath: featureWorktreePath, files: ["main.txt"]});
    await commit({repoPath: featureWorktreePath, message: "Update main in feature branch"});

    // Attempt to merge, expecting a conflict
    await git.checkout("main");
    const mergeResult = await merge({repoPath: mainRepoPath, branch: "feature/conflict"});

    assert.ok(!mergeResult.structuredContent.success);
    const error = mergeResult.structuredContent.error;
    assert.strictEqual(error.name, "MergeConflictError");
    assert.deepStrictEqual(error.conflicts, ["main.txt"]);
    assert.ok(error.remedy_tool_suggestions && error.remedy_tool_suggestions.length > 0);
  });
});
