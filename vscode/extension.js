"use strict";

const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("sutro.openDocs", () => {
      void vscode.env.openExternal(vscode.Uri.parse("https://docs.withsutro.com"));
    }),
    vscode.commands.registerCommand("sutro.openSlangIntro", () => {
      void vscode.env.openExternal(
        vscode.Uri.parse("https://docs.withsutro.com/docs/SLang/introduction"),
      );
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
