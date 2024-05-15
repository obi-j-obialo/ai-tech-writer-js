const axios = require("axios");
const os = require("os");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function formatDataForOpenAI(diffs, readmeContent, commitMessages) {
  let prompt = null;

  // Combine the changes into a string with clear delineation.
  let changes = diffs
    .map((file) => `File: ${file.filename}\nDiff: \n${file.patch}\n`)
    .join("\n");

  // Combine all commit messages
  let commitMessagesStr = commitMessages.join("\n") + "\n\n";

  // Decode the README content
  let readmeContentStr = Buffer.from(readmeContent.content, "base64").toString(
    "utf-8"
  );

  // Construct the prompt with clear instructions for the LLM.
  prompt =
    "Please review the following code changes and commit messages from a GitHub pull request:\n" +
    "Code changes from Pull Request:\n" +
    `${changes}\n` +
    "Commit messages:\n" +
    `${commitMessagesStr}` +
    "Here is the current README file content:\n" +
    `${readmeContentStr}\n` +
    "Consider the code changes and commit messages, determine if the README needs to be updated. If so, edit the README, ensuring to maintain its existing style and clarity.\n" +
    "Updated README:\n";

  return prompt;
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = "gpt-3.5-turbo-0125";

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are an AI trained to help me with updating README files based on commit messages and code changes.",
      },
      { role: "user", content: prompt },
    ];

    const response = await axios.post(
      "https://api.openai.com/v1/engines/davinci-codex/completions",
      {
        model: model,
        prompt: prompt,
        max_tokens: 100,
        temperature: 0.5,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].text;
  } catch (error) {
    console.error(`Error making LLM call: ${error}`);
    return null;
  }
}

async function updateReadmeAndCreatePR(repo, updatedReadme, readmeSha) {
  const commitMessage =
    "AI COMMIT: Proposed README update based on recent code changes.";
  const commitSha = process.env.GITHUB_SHA;
  const mainBranch = await octokit.git.getRef({
    owner: "owner",
    repo: "repo",
    ref: "heads/main",
  });
  const newBranchName = `update-readme-${commitSha.slice(0, 7)}`;
  await octokit.git.createRef({
    owner: "owner",
    repo: "repo",
    ref: `refs/heads/${newBranchName}`,
    sha: mainBranch.data.object.sha,
  });

  await octokit.repos.createOrUpdateFileContents({
    owner: "owner",
    repo: "repo",
    path: "README.md",
    message: commitMessage,
    content: Buffer.from(updatedReadme).toString("base64"),
    sha: readmeSha,
    branch: newBranchName,
  });

  const prTitle = "AI PR Update: README based on recent change";
  const prBody = "This is an AI PR. Please review the README";
  const pullRequest = await octokit.pulls.create({
    owner: "owner",
    repo: "repo",
    title: prTitle,
    head: newBranchName,
    base: "main",
    body: prBody,
  });

  return pullRequest;
}
