# Working in this repository

The user allows file inspection and edits without asking first. Before running any script, test, build, package manager command, application launch, extension installation, or publish command, ask for explicit approval of that action. Read-only file searches and Git inspection are allowed.

Keep the extension modular: each AI provider owns its usage reader and may provide a supported active-chat detector. Do not infer chat focus from private VS Code commands or the contents of another extension's webview.
