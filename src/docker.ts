import fetch from "node-fetch";

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

    const client = createDockerClient(registry);
    const [image, tag] = uri.replace(registry.endpoint + "/", "").split(":");

    const exists = await client.tagExists(image, tag);
    if (!exists) {
      return "not_found";
    }

    return "ok";
  };
}

function createDockerClient(registry: DockerRegistry) {
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
      const service = wwwAuthenticate.match(/service="(.+?)"/)[1];
      const scope = wwwAuthenticate.match(/scope="(.+?)"/)[1];

      // Repeat the original request with the new token.
      token = await fetchToken(realm, service, scope);
      return await apiFetch();
    }

    return result;
  }

  return {
    async tagExists(image: string, tag: string) {
      const result = await fetchApi(image + "/manifests/" + tag, {
        method: "HEAD",
        headers: {
          // Required for OCI images, which some namespaces use.
          Accept: "application/vnd.oci.image.index.v1+json",
        },
      });
      return result.ok;
    },
  };
}
