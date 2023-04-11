import * as fs from "node:fs";

const YAML_COMMENT_REGEX = /^\s*#/;

interface DockerRegistry {
  endpoint: string;
}

interface DockerURIMatch {
  uri: string;
  file: string;
  line: number;
}

export function dockerImageURIFinder(registries: DockerRegistry[]) {
  const regexes = registries.map(
    (registry) =>
      // A greedy regex to match Docker URIs such as: registry.uw.systems/partner-planner/analytics-api:c95a126b5dfbce50483aa52dc0a49ff968b8c15e
      new RegExp(
        "\\b" +
          escapeRegExp(registry.endpoint) +
          "/[\\w_-]+/[\\w_-]+:(\\w+)\\b",
        "gi"
      )
  );

  return function find(file: string): DockerURIMatch[] {
    const stats = fs.statSync(file);

    // Only allow files.
    if (!stats.isFile()) {
      console.warn(`Skipping ${file} because it's not a file`);
      return [];
    }

    // Skip large files.
    if (stats.size > 10 * 1024) {
      console.warn(`Skipping ${file} because it is too large`);
      return [];
    }

    const content = fs.readFileSync(file).toString();
    const lines = content.split("\n");

    const uris: DockerURIMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignore YAML comments.
      if (YAML_COMMENT_REGEX.test(line)) {
        continue;
      }

      for (const regex of regexes) {
        const matches = line.matchAll(regex);
        for (const match of matches) {
          uris.push({
            uri: match[0],
            file,
            line: i + 1,
          });
        }
      }
    }

    return uris;
  };
}

// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
