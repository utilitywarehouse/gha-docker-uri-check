import fs from "node:fs";
import parseDiff from "parse-diff";
import YAML, { LineCounter, YAMLMap } from "yaml";

const YAML_COMMENT_REGEX = /^\s*#/;
const KUSTOMIZE_REGEX = /^\s*newName|newTag:/;

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
    content: string,
    lineNumber: number,
    file: string
  ): DockerURIMatch {
    const match = content.match(KUSTOMIZE_REGEX);
    if (!match) {
      return null;
    }

    const contents = fs.readFileSync(file).toString();

    // Parse the YAML file into an AST so we can traverse it.
    const lineCounter = new LineCounter();
    const document = YAML.parseDocument(contents, { lineCounter });

    let result: DockerURIMatch;

    // Find the newTag node so we can look up the image it belongs to.
    YAML.visit(document, {
      Scalar(_, node, path) {
        // We only care about the node on the change's line number.
        if (lineCounter.linePos(node.range[0]).line !== lineNumber) {
          return;
        }

        // Find the image entry from the "images" list.
        const image = path[path.length - 2];
        if (!(image instanceof YAMLMap)) {
          return YAML.visit.SKIP;
        }

        const imageName = image.get("newName") ?? image.get("name");
        const tag = image.get("newTag");

        result = {
          uri: imageName + ":" + tag,
          line: lineNumber,
          file,
        };

        return YAML.visit.BREAK;
      },
    });

    return result;
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
