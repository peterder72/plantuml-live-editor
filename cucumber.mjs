const commonPaths = ["user-scenarios/features/common/**/*.feature"];

const base = {
  parallel: 0,
  publish: false,
  strict: true,
};

export default async function profiles() {
  return {
    "web-chromium": {
      ...base,
      paths: [...commonPaths, "user-scenarios/features/web/**/*.feature"],
      require: [".scenario-dist/web.cjs"],
      worldParameters: { browserName: "chromium" },
      format: [
        "progress",
        ["json", "test-results/cucumber/web-chromium.json"],
      ],
    },
    "web-firefox": {
      ...base,
      paths: [...commonPaths, "user-scenarios/features/web/**/*.feature"],
      require: [".scenario-dist/web.cjs"],
      worldParameters: { browserName: "firefox" },
      format: [
        "progress",
        ["json", "test-results/cucumber/web-firefox.json"],
      ],
    },
    vscode: {
      ...base,
      paths: [...commonPaths, "user-scenarios/features/vscode/**/*.feature"],
      require: [".scenario-dist/vscode.cjs"],
      format: ["progress", ["json", "test-results/cucumber/vscode.json"]],
    },
  };
}
