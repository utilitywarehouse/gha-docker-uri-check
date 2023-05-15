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

type Finder = (change: Change) => DockerURIMatch;

interface Change {
  content: string;
  lineNumber: number;
  file: string;
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

  function uriFromKustomize(change: Change): DockerURIMatch {
    const match = change.content.match(KUSTOMIZE_REGEX);
    if (!match) {
      return null;
    }

    const contents = fs.readFileSync(change.file).toString();

    // Parse the YAML file into an AST so we can traverse it.
    const lineCounter = new LineCounter();
    const documents = YAML.parseAllDocuments(contents, { lineCounter });

    for (const document of documents) {
      // We only care about Kustomization manifests.
      if (document.get("kind") !== "Kustomization") {
        continue;
      }

      let result: DockerURIMatch;

      // Find the newTag node so we can look up the image it belongs to.
      YAML.visit(document, {
        Scalar(_, node, path) {
          // We only care about the node on the change's line number.
          if (lineCounter.linePos(node.range[0]).line !== change.lineNumber) {
            return;
          }

          // Find the image entry from the "images" list.
          const image = path[path.length - 2];
          if (!(image instanceof YAMLMap)) {
            return YAML.visit.SKIP;
          }

          const imageName = (image.get("newName") ??
            image.get("name")) as string;

          // Skip any images that don't belong to the registries we care about.
          if (
            !registries.some((registry) =>
              imageName.startsWith(registry.endpoint)
            )
          ) {
            return YAML.visit.SKIP;
          }

          const tag = image.get("newTag") ?? image.get("tag");

          result = {
            uri: imageName + ":" + tag,
            line: change.lineNumber,
            file: change.file,
          };

          return YAML.visit.BREAK;
        },
      });

      if (result) {
        return result;
      }
    }

    return null;
  }

  function uriFromRegex(change: Change): DockerURIMatch {
    for (const regex of regexes) {
      const matches = change.content.matchAll(regex);
      for (const match of matches) {
        return {
          uri: match[0],
          line: change.lineNumber,
          file: change.file,
        };
      }
    }
    return null;
  }

  const finders: Finder[] = [uriFromKustomize, uriFromRegex];

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

          // Try to find a Docker URI via one of the finders.
          for (const finder of finders) {
            let uri: DockerURIMatch;
            try {
              uri = finder({
                content: line,
                lineNumber: change.ln,
                file: file.to,
              });
            } catch (error) {
              console.error(
                `Error trying to extract URI via ${finder.name}:`,
                error
              );
              continue;
            }

            if (uri) {
              uris.push(uri);
              break;
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
