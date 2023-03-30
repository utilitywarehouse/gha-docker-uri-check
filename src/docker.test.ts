import * as test from "tape";
import * as dotenv from "dotenv";
import { dockerRegistryChecker } from "./docker";

dotenv.config();

test("docker registry checker", async (t) => {
  const check = makeChecker();

  test("valid tag", async (t) => {
    const status = await check(
      "registry.uw.systems/partner-planner/analytics-api-api:c95a126b5dfbce50483aa52dc0a49ff968b8c15e"
    );
    t.equal(status, "ok");
  });

  test("non-existent tag", async (t) => {
    const status = await check(
      "registry.uw.systems/partner-planner/analytics-api-api:iDontExist"
    );
    t.equal(status, "not_found");
  });
});

function makeChecker() {
  const {
    TEST_DOCKER_REGISTRY,
    TEST_DOCKER_REGISTRY_USERNAME,
    TEST_DOCKER_REGISTRY_PASSWORD,
  } = process.env;

  if (
    !TEST_DOCKER_REGISTRY ||
    !TEST_DOCKER_REGISTRY_USERNAME ||
    !TEST_DOCKER_REGISTRY_PASSWORD
  ) {
    throw Error("Missing environment variables for UW Docker registry");
  }

  return dockerRegistryChecker([
    {
      endpoint: TEST_DOCKER_REGISTRY,
      username: TEST_DOCKER_REGISTRY_USERNAME,
      password: TEST_DOCKER_REGISTRY_PASSWORD,
    },
  ]);
}
