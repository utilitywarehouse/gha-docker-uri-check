import fetch from "node-fetch";

export interface DockerRegistry {
  endpoint: string;
  username: string;
  password: string;
}

export type Status = "ok" | "not_found";

export function dockerRegistryChecker(registries: DockerRegistry[]) {
  const clients = new Map<string, DockerClient>();

  return async function check(uri: string): Promise<Status> {
    const registry = registries.find((registry) =>
      uri.startsWith(registry.endpoint)
    );

    if (!registry) {
      throw Error("Couldn't find a registry for Docker URI");
    }

    // Cache a client per registry endpoint to avoid re-authenticating every time.
    let client = clients.get(registry.endpoint);
    if (!client) {
      client = createDockerClient(registry);
      clients.set(registry.endpoint, client);
    }

    const [image, tag] = uri.replace(registry.endpoint + "/", "").split(":");

    const exists = await client.tagExists(image, tag);
    if (!exists) {
      return "not_found";
    }

    return "ok";
  };
}

interface DockerClient {
  tagExists(image: string, tag: string): Promise<boolean>;
}

function createDockerClient(registry: DockerRegistry): DockerClient {
  let token;

  async function fetchApi(path, config) {
    function apiFetch() {
      const headers = {
        ...config.headers,
      };
      if (token) {
        headers["Authorization"] = "Bearer " + token;
      }
      return fetch(`https://${registry.endpoint}/v2/` + path, {
        ...config,
        headers,
      });
    }

    async function fetchToken(realm: string, service: string, scope: string) {
      const result = await fetch(
        realm +
          `?service=${encodeURIComponent(service)}&scope=${encodeURIComponent(
            scope
          )}`,
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(registry.username + ":" + registry.password).toString(
                "base64"
              ),
          },
        }
      );
      if (!result.ok) {
        throw new Error(result.statusText);
      }
      const data = (await result.json()) as { token: string };
      return data.token;
    }

    let result = await apiFetch();

    // This header means the client has to fetch a token and retry the original request.
    const wwwAuthenticate = result.headers.get("www-authenticate");
    if (wwwAuthenticate) {
      // Not super robust, but good enough.
      const realm = wwwAuthenticate.match(/realm="(.+?)"/)[1];
      if (!realm) {
        throw Error("Couldn't find realm in www-authenticate header");
      }
      const service = wwwAuthenticate.match(/service="(.+?)"/)[1];
      if (!service) {
        throw Error("Couldn't find service in www-authenticate header");
      }
      const scope = wwwAuthenticate.match(/scope="(.+?)"/)[1];
      if (!scope) {
        throw Error("Couldn't find scope in www-authenticate header");
      }

      // Repeat the original request with the new token.
      token = await fetchToken(realm, service, scope);
      return await apiFetch();
    }

    return result;
  }

  return {
    async tagExists(image: string, tag: string): Promise<boolean> {
      const result = await fetchApi(image + "/manifests/" + tag, {
        method: "HEAD",
        headers: {
          // Required for OCI images, which some namespaces use.
          Accept: [
            "application/vnd.oci.image.index.v1+json",
            "application/vnd.oci.image.manifest.v1+json"
          ].join(",")
        },
      });
      return result.ok;
    },
  };
}
