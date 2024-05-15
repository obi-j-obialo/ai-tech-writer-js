const { Octokit } = require("@octokit/rest");
require("dotenv").config();

async function main() {
  // Initialize GitHub API with token
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Get the repo path and PR number from the environment variables
  const repo_path = process.env.REPO_PATH.split("/");
  const pull_request_number = Number(process.env.PR_NUMBER);

  // Fetch README content (assuming README.md)
  const readme_content = await octokit.repos.getContent({
    owner: repo_path[0],
    repo: repo_path[1],
    path: "README.md",
  });

  // Fetch pull request by number
  const pull_request = await octokit.pulls.get({
    owner: repo_path[0],
    repo: repo_path[1],
    pull_number: pull_request_number,
  });

  // Get the diffs of the pull request
  const pull_request_diffs = pull_request.data.files.map((file) => ({
    filename: file.filename,
    patch: file.patch,
  }));

  // Get the commit messages associated with the pull request
  let commits = await octokit.pulls.listCommits({
    owner: repo_path[0],
    repo: repo_path[1],
    pull_number: pull_request_number,
  });
  let commit_messages = commits.data.map((commit) => commit.commit.message);

  // Format data for OpenAI prompt
  let prompt = formatDataForOpenAI(
    pull_request_diffs,
    readme_content,
    commit_messages
  );

  // Call OpenAI to generate the updated README content
  let updated_readme = callOpenAI(prompt);

  // Create PR for Updated PR
  updateReadmeAndCreatePR(repo, updated_readme, readme_content.sha);
}

main();
