import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const dockerMock = vi.hoisted(() => ({
  startCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("dockerode", () => {
  class Dockerode {
    modem = {
      demuxStream(stream: PassThrough, stdout: PassThrough) {
        stream.pipe(stdout);
      },
    };

    getContainer() {
      return {
        exec: async () => ({
          start: async (opts: Record<string, unknown>) => {
            dockerMock.startCalls.push(opts);
            const stream = new PassThrough();
            queueMicrotask(() => {
              stream.write("ok");
              stream.end();
            });
            return stream;
          },
          inspect: async () => ({ Running: false, ExitCode: 0 }),
        }),
      };
    }
  }

  return { default: Dockerode };
});

import { DockerEdgeExecutor } from "./docker-edge-executor";

describe("DockerEdgeExecutor", () => {
  it("starts docker exec without hijack for non-interactive edge commands", async () => {
    dockerMock.startCalls.length = 0;
    const executor = new DockerEdgeExecutor({ containerName: "openship-edge" });

    await expect(executor.exec("openresty -t")).resolves.toBe("ok");

    expect(dockerMock.startCalls).toEqual([{ Detach: false, Tty: false }]);
  });
});
