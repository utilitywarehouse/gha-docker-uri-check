import * as core from "@actions/core";
import * as glob from "@actions/glob";

import { DockerRegistry, dockerRegistryChecker } from "./docker";
import { dockerImageURIFinder } from "./find";

// Entry point for the GitHub Action.
(async function run() {
  const registries = getDockerRegistriesFromInput();
  const findURIs = dockerImageURIFinder(registries);
  const checkURI = dockerRegistryChecker(registries);

  const files = await glob
    .create(["**/*.yaml", "**/*.yml"].join("\n"), { matchDirectories: false })
    .then((globber) => globber.glob());

  const matches = files.flatMap(findURIs);

  for (const match of matches) {
    const status = await checkURI(match.uri);
    const annotation = {
      file: match.file,
      startLine: match.line,
    };
    switch (status) {
      case "not_found":
        core.error(
          `The Docker image "${match.uri}" does not exist. Is the tag correct?`,
          {
            ...annotation,
            title: "Non-existent Docker image",
          }
        );
        break;
      // case "outdated":
      //   core.warning(
      //     `The Docker image "${uri.uri}" does not correspond to the "latest" tag. Is this ok?`,
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
