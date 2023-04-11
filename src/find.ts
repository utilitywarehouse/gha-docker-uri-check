import * as fs from "node:fs";

const YAML_COMMENT_REGEX = /\s+#/;

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
      new RegExp(
        registry.endpoint.replace(".", "\\.") + "/.+/.+:([a-z0-9]+)",
        "i"
      )
  );

  return function find(file: string): DockerURIMatch[] {
    const content = fs.readFileSync(file).toString();
    const lines = content.split("\n");

    const uris: DockerURIMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (YAML_COMMENT_REGEX.test(line)) {
        continue;
      }
      for (const regex of regexes) {
        const match = line.match(regex);
        if (match) {
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
