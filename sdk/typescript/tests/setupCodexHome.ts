import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach } from "@jest/globals";

const originalDeepSeekXHome = process.env.DEEPSEEKX_HOME;
let currentDeepSeekXHome: string | undefined;

beforeEach(async () => {
  currentDeepSeekXHome = await fs.mkdtemp(path.join(os.tmpdir(), "deepseekx-sdk-test-"));
  process.env.DEEPSEEKX_HOME = currentDeepSeekXHome;
});

afterEach(async () => {
  const deepseekxHomeToDelete = currentDeepSeekXHome;
  currentDeepSeekXHome = undefined;

  if (originalDeepSeekXHome === undefined) {
    delete process.env.DEEPSEEKX_HOME;
  } else {
    process.env.DEEPSEEKX_HOME = originalDeepSeekXHome;
  }

  if (deepseekxHomeToDelete) {
    await fs.rm(deepseekxHomeToDelete, { recursive: true, force: true });
  }
});
