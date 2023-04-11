import * as test from "tape";
import { dockerImageURIFinder } from "./find";

test("docker URI finder", async (t) => {
  const find = dockerImageURIFinder([{ endpoint: "registry.uw.systems" }]);

  test("file with Docker URIs", async (t) => {
    const matches = find("test-fixtures/k8s-manifest.yaml");
    t.deepEqual(matches, [
      {
        uri: "registry.uw.systems/partner-planner/analytics-api-api:c95a126b5dfbce50483aa52dc0a49ff968b8c15e",
        file: "test-fixtures/k8s-manifest.yaml",
        line: 61,
      },
    ]);
  });
});
