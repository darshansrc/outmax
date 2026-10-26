import { test } from "bun:test";

// Existing lead tests replace the entire AI SDK module. Run these SDK streaming
// fixtures separately so the two suites cannot overwrite one another's mocks.
test("persistent chat history regression suite", () => {
  const result = Bun.spawnSync([process.execPath, "test", "./tests/fixtures/chat-history.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
  }
});
