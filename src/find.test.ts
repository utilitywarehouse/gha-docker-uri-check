import * as test from "tape";
import { dockerImageURIFinder } from "./find";

test("docker URI finder", async (t) => {
  const find = dockerImageURIFinder([{ endpoint: "registry.uw.systems" }]);

  test("empty file", async (t) => {
    const matches = find("test-fixtures/empty.yaml");
    t.deepEqual(matches, []);
  });

  test("commented out", async (t) => {
    const matches = find("test-fixtures/commented.yaml");
    t.deepEqual(matches, []);
  });

  test("single URI", async (t) => {
    const matches = find("test-fixtures/single.yaml");
    t.deepEqual(matches, [
      {
        uri: "registry.uw.systems/partner-planner/analytics-api:c95a126b5dfbce50483aa52dc0a49ff968b8c15e",
        file: "test-fixtures/single.yaml",
        line: 61,
      },
    ]);
  });

  test("multiple URIs in same file", async (t) => {
    const matches = find("test-fixtures/multiple.yaml");
    t.deepEqual(matches, [
      {
        uri: "registry.uw.systems/partner-planner/analytics-api:c95a126b5dfbce50483aa52dc0a49ff968b8c15e",
        file: "test-fixtures/multiple.yaml",
        line: 61,
      },
      {
        uri: "registry.uw.systems/partner-planner/something-else:latest",
        file: "test-fixtures/multiple.yaml",
        line: 61,
      },
      {
        uri: "registry.uw.systems/partner-planner/foo:bar",
        file: "test-fixtures/multiple.yaml",
        line: 97,
      },
    ]);
  });
});
