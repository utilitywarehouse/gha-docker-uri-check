import { spawnSync } from "node:child_process";
import github from "@actions/core";

import { DockerRegistry, dockerRegistryChecker, Status } from "./docker";
import { dockerImageURIFinder } from "./find";

const MAX_CHECKS = 1000;

// Entry point for the GitHub Action.
(async function run() {
  const registries = getDockerRegistriesFromInput();
  const findURIs = dockerImageURIFinder(registries);
  const checkURI = dockerRegistryChecker(registries);

  // The ref to compare against. This is usually "master" or whatever branch a PR is set to merge into.
  const mergeBase = github.getInput("merge-base");

  // Restrict the diff to files with these extensions.
  const fileExtensions = github
    .getInput("file-extensions")
    .split(",")
    .map((ext) => ext.trim());

  const diff = gitDiff(mergeBase, fileExtensions);
  console.log("Diff: ", diff);
  const matches = findURIs(diff);

  // Don't check too many URIs, as this could cause a crash.
  if (matches.length > MAX_CHECKS) {
    github.setFailed(
      `Found too many Docker URIs to check: ${matches.length} (max: ${MAX_CHECKS})`
    );
    return;
  }

  for (const match of matches) {
    const annotation = {
      file: match.file,
      startLine: match.line,
    };

    let status: Status;
    try {
      status = await checkURI(match.uri);
    } catch (error) {
      github.error(`Check for "${match.uri}" failed due to: ${error}`, {
        ...annotation,
        title: "Docker image check failed",
      });
      continue;
    }

    switch (status) {
      case "not_found":
        github.error(
          `The image "${match.uri}" does not exist. Is the tag correct?`,
          { ...annotation, title: "Non-existent Docker image" }
        );
        break;
      // case "outdated":
      //   core.warning(
      //     `The image "${uri.uri}" does not correspond to the "latest" tag. Is this ok?`,
      //     {
      //       ...annotation,
      //       title: "Outdated Docker image",
      //     }
      //   );
      //   break;
    }
  }
})();

function getDockerRegistriesFromInput(): DockerRegistry[] {
  interface DockerRegistriesInput {
    [endpoint: string]: {
      username: string;
      password: string;
    };
  }
  const registriesInput = JSON.parse(
    github.getInput("docker-registries")
  ) as DockerRegistriesInput;

  return Object.entries(registriesInput).map(([endpoint, values]) => ({
    endpoint,
    ...values,
  }));
}

function gitDiff(mergeBase: string, allowedExtensions: string[]): string {
  const extensionFilter = allowedExtensions.map((ext) => "*." + ext);

  const args = ["diff", "--merge-base", mergeBase];
  console.log("Args: ", args);
  console.log("CWD: ", process.cwd());

  const output = spawnSync("git", args, {
    timeout: 5000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (output.error) {
    throw output.error;
  }
  return output.stdout.toString();
}
