import parseDiff from "parse-diff";

const YAML_COMMENT_REGEX = /^\s*#/;

interface DockerRegistry {
  endpoint: string;
}

export interface DockerURIMatch {
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

  return function find(diff: string): DockerURIMatch[] {
    const files = parseDiff(diff);
    const uris: DockerURIMatch[] = [];

    for (const file of files) {
      for (const chunk of file.chunks) {
        for (const change of chunk.changes) {
          if (change.type !== "add") {
            continue;
          }

          // Strip the "+" prefix.
          const line = change.content.substring(1);

          // Ignore YAML comments.
          if (YAML_COMMENT_REGEX.test(line)) {
            continue;
          }

          for (const regex of regexes) {
            const matches = line.matchAll(regex);
            for (const match of matches) {
              uris.push({
                uri: match[0],
                file: file.to,
                line: change.ln,
              });
            }
          }
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
