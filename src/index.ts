import * as core from "@actions/core";
import { glob } from "glob";

import { DockerRegistry, dockerRegistryChecker, Status } from "./docker";
import { dockerImageURIFinder } from "./find";

const MAX_CHECKS = 1000;

// Entry point for the GitHub Action.
(async function run() {
  const registries = getDockerRegistriesFromInput();
  const findURIs = dockerImageURIFinder(registries);
  const checkURI = dockerRegistryChecker(registries);

  const files = await glob(core.getInput("patterns"), {
    cwd: core.getInput("working-directory"),
    nodir: true,
  });

  const matches = files.flatMap(findURIs);

  // Don't check too many URIs, as this could cause a crash.
  if (matches.length > MAX_CHECKS) {
    core.setFailed(
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
      core.error(`Check for "${match.uri}" failed due to: ${error}`, {
        ...annotation,
        title: "Docker image check failed",
      });
      continue;
    }

    switch (status) {
      case "not_found":
        core.error(
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
  const registriesInput = core.getInput("docker-registries", {
    required: true,
  }) as unknown as DockerRegistriesInput;

  return Object.entries(registriesInput).map(([endpoint, values]) => ({
    endpoint,
    ...values,
  }));
}
