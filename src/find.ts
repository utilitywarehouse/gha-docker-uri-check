import fs from "node:fs";
import parseDiff from "parse-diff";
import YAML, { Scalar, LineCounter, YAMLMap } from "yaml";

const YAML_COMMENT_REGEX = /^\s*#/;
const KUSTOMIZE_NEW_TAG_REGEX = /^\s*newTag:\s*([\w-_]+)\b/;

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

  function uriFromKustomize(
    line: string,
    lineNumber: number,
    file: string
  ): DockerURIMatch {
    const match = line.match(KUSTOMIZE_NEW_TAG_REGEX);
    if (!match) {
      return null;
    }
    const tag = match[1];

    const contents = fs.readFileSync(file).toString();

    const lineCounter = new LineCounter();

    // Parses into an AST, not a JS object.
    const document = YAML.parseDocument(contents, {
      keepSourceTokens: true,
      lineCounter,
    });

    let uri: DockerURIMatch;

    // Find the newTag node so we can look up the image it belongs to.
    YAML.visit(document, {
      Scalar(_, node, path) {
        if (
          node.value !== tag ||
          // Ensure the tag is on the expected line.
          lineCounter.linePos(node.srcToken.offset).line !== lineNumber
        ) {
          return;
        }

        const parent = path[path.length - 2] as YAMLMap;

        if (!parent) {
          return YAML.visit.SKIP;
        }

        const imageName = parent.get("newName") ?? parent.get("name");

        uri = {
          uri: imageName + ":" + tag,
          line: lineNumber,
          file,
        };

        return YAML.visit.BREAK;
      },
    });

    return uri;
  }

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

          let kustomizeMatch;
          try {
            kustomizeMatch = uriFromKustomize(line, change.ln, file.to);
          } catch (error) {
            console.error(
              "Error trying to extract URI using Kustomize heuristics:",
              error
            );
            continue;
          }
          if (kustomizeMatch) {
            uris.push(kustomizeMatch);
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
