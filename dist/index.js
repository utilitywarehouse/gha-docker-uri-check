var github = /*@__PURE__*/getDefaultExportFromCjs(coreExports);
  if (index[domain]) {
    if (index[starstr]) { // star rule matches
      if (index[partstr] === false) { // exception rule matches (NB: false, not undefined)
    } else if (index[partstr]) { // exact match, not exception
  if (index['*'+suffix]) { // *.domain exists (e.g. *.kyoto.jp for domain='kyoto.jp');
var index = pubsuffix$1.index = Object.freeze(
var parseDiff$1 = /*@__PURE__*/getDefaultExportFromCjs(parseDiff);
    const mergeBase = github.getInput("merge-base");
    const fileExtensions = github
        .getInput("file-extensions")
        github.setFailed(`Found too many Docker URIs to check: ${matches.length} (max: ${MAX_CHECKS})`);
            github.error(`Check for "${match.uri}" failed due to: ${error}`, {
                github.error(`The image "${match.uri}" does not exist. Is the tag correct?`, { ...annotation, title: "Non-existent Docker image" });
    const registriesInput = JSON.parse(github.getInput("docker-registries"));
    const extensionFilter = allowedExtensions.map((ext) => "*." + ext);
    const output = node_child_process.spawnSync("git", ["diff", "--merge-base", mergeBase, "--", ...extensionFilter], {