import test from "tape";
import dotenv from "dotenv";
import { dockerRegistryChecker } from "./docker";

dotenv.config();

test("docker registry checker", async (t) => {
  const check = makeChecker();

  t.test("valid tag", async (t) => {
    const status = await check(
      "registry.uw.systems/partner-planner/analytics-api-api:c95a126b5dfbce50483aa52dc0a49ff968b8c15e"
    );
    t.equal(status, "ok");
  });

  t.test("valid tag on OCI image", async (t) => {
    const status = await check(
      "registry.uw.systems/data-platform/di-bigquery-connector:e3acca03cf16920eaca0828a93e6400aee98835a"
    );
    t.equal(status, "ok");
  });

  t.test("non-existent tag", async (t) => {
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
