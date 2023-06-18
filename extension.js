const vscode = require('vscode');

// Represents a file item in the file explorer
class FileItem {
    constructor(uri, selected = false) {
        this.uri = uri;
        this.selected = selected;
    }

    toggleSelected() {
        this.selected = !this.selected;
    }
}

// Represents the selected files in the file explorer
const selectedFiles = [];

// Tree data provider for the selected files
class FileDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return {
            label: element.uri.fsPath,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        };
    }

    getChildren(element) {
        if (element) {
            return [];
        }

        // Return only the selected files
        return selectedFiles.filter(file => file.selected);
    }
}

// Command for adding files to gpt-contextfiles
const addFilesCommand = vscode.commands.registerCommand('extension.addFilesToGPTContext', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const uri = editor.document.uri;
        const existingFileIndex = selectedFiles.findIndex(file => file.uri.fsPath === uri.fsPath);

        if (existingFileIndex !== -1) {
            // File already exists, remove it from the list
            selectedFiles.splice(existingFileIndex, 1);
        } else {
            // Add the file to the list with selected state
            selectedFiles.push(new FileItem(uri, true));
        }

        fileDataProvider.refresh();
    }
});

const fileDataProvider = new FileDataProvider();

// Command for displaying the webview panel
const openGPTContextPanelCommand = vscode.commands.registerCommand('extension.openGPTContextPanel', () => {
    const panel = vscode.window.createWebviewPanel(
        'gptContextPanel',
        'GPT Context',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'submitQuestion') {
            const question = message.text;
            const fileContents = selectedFiles
                .map(file => {
                    const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === file.uri.fsPath);
                    if (document) {
                        const lines = document.getText().split('\n');
                        return `${file.uri.fsPath}\n${lines.join('\n')}`;
                    }
                    return '';
                })
                .join('\n\n');

            panel.webview.html = getWebviewContent(fileContents, question);
        } else if (message.command === 'toggleFileSelection') {
            const uri = message.uri;
            const file = selectedFiles.find(file => file.uri.fsPath === uri);
            if (file) {
                file.toggleSelected();
                fileDataProvider.refresh();
            }
        } else if (message.command === 'clearSelectedFiles') {
            const clearedFiles = selectedFiles.filter(file => file.selected === false);
            selectedFiles.length = 0; // Clear the array
            clearedFiles.forEach(file => {
                fileDataProvider.refresh();
            });
            panel.webview.html = getWebviewContent();
        } else if (message.command === 'refreshFiles') {
            fileDataProvider.refresh();
            panel.webview.html = getWebviewContent();
        }
    });
});

// Command for refreshing the selected files
const refreshSelectedFilesCommand = vscode.commands.registerCommand('extension.refreshSelectedFiles', () => {
    fileDataProvider.refresh();
});

// Command for clearing the selected files
const clearSelectedFilesCommand = vscode.commands.registerCommand('extension.clearSelectedFiles', () => {
    selectedFiles.forEach(file => {
        file.selected = false;
    });
    fileDataProvider.refresh();
});

// Command for refreshing all files
const refreshFilesCommand = vscode.commands.registerCommand('extension.refreshFiles', () => {
    fileDataProvider.refresh();
});

// Helper function to generate the HTML content for the webview panel
function getWebviewContent(fileContents, question) {
  const fileList = selectedFiles
      .map(
          file =>
              `<div><input type="checkbox" ${
                  file.selected ? 'checked' : ''
              } onchange="toggleFileSelection('${file.uri.fsPath}')" /> ${file.uri.fsPath}</div>`
      )
      .join('');

  const formattedContents = selectedFiles
      .map(file => {
          const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === file.uri.fsPath);
          if (document) {
              const lines = document.getText().split('\n');
              const formattedLines = lines.map(line => `\t${line}`).join('\n');
              return `${file.uri.fsPath}:\n\`\`\`\n${formattedLines}\n\`\`\``;
          }
          return '';
      })
      .join('\n\n');

  return `
      <html>
      <body>
          <h1>GPT Context</h1>
          <form id="questionForm">
              <div>
                  <label for="question">Enter your question:</label>
                  <input type="text" id="question" name="question" required>
                  <button type="submit">Submit</button>
                  <button type="button" onclick="clearSelectedFiles()">Clear</button>
                  <button type="button" onclick="refreshSelectedFiles()">Refresh</button>
              </div>
              <div>
                <div><pre>${question ? question : ''}</pre></div>
                ${
                    fileContents ? `<div><pre>${formattedContents}</pre></div>` : ''
                }
              </div>
              <div>
                  <h2>Selected Files:</h2>
                  ${fileList}
              </div>
              <script>
                  const vscode = acquireVsCodeApi();

                  function toggleFileSelection(uri) {
                      vscode.postMessage({
                          command: 'toggleFileSelection',
                          uri: uri
                      });
                  }

                  function clearSelectedFiles() {
                      vscode.postMessage({
                          command: 'clearSelectedFiles'
                      });
                  }

                  function refreshSelectedFiles() {
                      vscode.postMessage({
                          command: 'refreshFiles'
                      });
                  }

                  const form = document.getElementById('questionForm');
                  form.addEventListener('submit', event => {
                      event.preventDefault();
                      const question = document.getElementById('question').value;
                      vscode.postMessage({
                          command: 'submitQuestion',
                          text: question
                      });
                  });
              </script>
          </body>
          </html>
      `;
}


// Activates the extension
function activate(context) {
    // Register the file data provider
    vscode.window.registerTreeDataProvider('gpt-contextfiles', fileDataProvider);

    // Register the commands
    context.subscriptions.push(addFilesCommand);
    context.subscriptions.push(openGPTContextPanelCommand);
    context.subscriptions.push(refreshSelectedFilesCommand);
    context.subscriptions.push(clearSelectedFilesCommand);
    context.subscriptions.push(refreshFilesCommand);

    // Refresh the file data provider when a file is added or removed from the workspace
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        fileDataProvider.refresh();
    });

    // Refresh the file data provider when a file is created, deleted, or renamed within the workspace
    vscode.workspace.onDidChangeTextDocument(() => {
        fileDataProvider.refresh();
    });
}

module.exports = {
    activate
};
