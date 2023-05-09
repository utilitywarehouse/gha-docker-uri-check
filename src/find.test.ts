import fs from "node:fs";
import test from "tape";
import { dockerImageURIFinder, DockerURIMatch } from "./find";

interface Test {
  name: string;
  file: string;
  expected: DockerURIMatch[];
}

const tests: Test[] = [
  {
    name: "empty file",
    file: "test-fixtures/empty.diff",
    expected: [],
  },
  {
    name: "commented out",
    file: "test-fixtures/commented.diff",
    expected: [],
  },
  {
    name: "single URI",
    file: "test-fixtures/single.diff",
    expected: [
      {
        uri: "registry.uw.systems/partner-planner/backend:foo",
        file: "prod-aws/partner-planner/backend.yaml",
        line: 58,
      },
    ],
  },
  {
    name: "multiple URIs in same file",
    file: "test-fixtures/multiple.diff",
    expected: [
      {
        uri: "registry.uw.systems/partner-planner/backend:c95a126b5dfbce50483aa52dc0a49ff968b8c15e",
        file: "prod-aws/partner-planner/backend.yaml",
        line: 58,
      },
      {
        uri: "registry.uw.systems/partner-planner/something-else:latest",
        file: "prod-aws/partner-planner/backend.yaml",
        line: 121,
      },
      {
        uri: "registry.uw.systems/partner-planner/foo:bar",
        file: "prod-aws/partner-planner/backend.yaml",
        line: 123,
      },
    ],
  },
  {
    name: "URIs from changes in multiple files",
    file: "test-fixtures/multiple-files.diff",
    expected: [
      {
        uri: "registry.uw.systems/partner-planner/assistant-cards:bar",
        file: "prod-aws/partner-planner/assistant-card-reader.yaml",
        line: 25,
      },
      {
        uri: "registry.uw.systems/partner-planner/backend:foo",
        file: "prod-aws/partner-planner/backend.yaml",
        line: 58,
      },
    ],
  },
  {
    name: "Kustomize newTag",
    file: "test-fixtures/kustomize-newTag/change.diff",
    expected: [
      {
        uri: "registry.uw.systems/auth/iam-auth-key-updater:foo",
        file: "test-fixtures/kustomize-newTag/kustomization.yaml",
        line: 10,
      },
    ],
  },
];

test("docker URI finder", (t) => {
  const find = dockerImageURIFinder([{ endpoint: "registry.uw.systems" }]);

  for (const test of tests) {
    t.test(test.name, (t) => {
      const diff = fs.readFileSync(test.file).toString();
      const matches = find(diff);
      t.deepEqual(matches, test.expected);
      t.end();
    });
  }
});
