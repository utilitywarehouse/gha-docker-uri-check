import { createClientV2 } from "docker-registry-client";

export interface DockerRegistry {
  endpoint: string;
  username: string;
  password: string;
}

export type Status = "ok" | "not_found";

export function dockerRegistryChecker(registries: DockerRegistry[]) {
  return async function check(uri: string): Promise<Status> {
    const registry = registries.find((registry) =>
      uri.startsWith(registry.endpoint)
    );

    if (!registry) {
      throw Error("Couldn't find a registry for Docker URI");
    }

    const [repoName, tag] = uri.split(":");

    // Unfortunately, the docker-registry-client library requires a full registry URL, so we can't cache this.
    const client = createClientV2({
      name: repoName,
      username: registry.username,
      password: registry.password,
    });

    try {
      await new Promise((resolve, reject) => {
        client.getManifest({ ref: tag }, (err, manifest) => {
          if (err) {
            reject(err);
          } else {
            resolve(manifest);
          }
        });
      });
    } catch (error) {
      if (error.body?.code === "NotFoundError") {
        return "not_found";
      }
      throw error;
    } finally {
      // Need to close otherwise the program hangs and never exits.
      client.close();
    }

    return "ok";
  };
}
