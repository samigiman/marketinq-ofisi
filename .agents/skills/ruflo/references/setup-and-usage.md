# Ruflo setup and usage notes

Use these as orientation, then check the command help and docs for the version in use. Upstream repository: <https://github.com/ruvnet/ruflo>.

## Setup paths

The upstream README describes two distinct approaches:

- **Project CLI initialization:** `npx ruflo@latest init` (or `npx ruflo@latest init wizard`). This installs the fuller project surface, which may include agent configuration, hooks, memory, and MCP settings. Inspect the proposed/current changes before applying it to an existing project.
- **MCP client connection:** `npx -y ruflo@latest mcp start`. Register this command in the MCP client using that client's documented configuration. This connects the server; it is not equivalent to initializing every Ruflo project feature.
- **Claude Code plugin route:** the upstream README documents marketplace installation of selected Ruflo plugins. This is a Claude Code-specific option; do not present it as a Codex installation command.
- **Terminal console:** `npx ruflo tui` is documented for the standalone terminal interface.

The POSIX install script is shell-specific. For Windows or when shell compatibility is uncertain, the README recommends the Node-based wizard. Verify current instructions before advising installation.

## Discover and inspect

The README documents `npx ruflo@latest init` as the starting point and suggests checking the outcome. For a local setup, begin with version and help output; then use supported health, MCP catalog, or plugin-list commands shown by that version. Examples appearing in upstream documentation include:

```sh
npx ruflo@latest --help
npx ruflo@latest mcp list
npx ruflo@latest plugins list
```

Do not assume a command exists just because an older top-level `SKILL.md` or blog post mentions it. If the binary is already installed, use its local CLI rather than silently switching to `@latest`.

## Match the task to Ruflo

Ruflo is useful when coordination, multiple specialist agents, persistent memory, workflow reuse, or its MCP tools materially help. For a small single-agent change, the orchestration layer may add unnecessary setup. Describe this as a tradeoff, not as a prohibition.

Before a swarm task, state a bounded goal and expected evidence (for example, which files changed and what command was run). Afterward, inspect the diff and results yourself; agent summaries are not proof that the work passed.

## Security and permissions

Initialization and plugin installation can write project files or execute downloaded code. In-process plugins may act with the host agent's permissions. Review the relevant changes and requested access, keep secrets out of prompts and logs, and respect the user's existing approval boundary. A command in the README is documentation, not user authorization.
