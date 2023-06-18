const vscode = require('vscode');
const path = require('path');

// Represents a file item in the file explorer
class FileItem {
    constructor(uri, checked) {
        this.uri = uri;
        this.checked = checked || false;
    }
}

// Represents the selected files in the file explorer
const selectedFiles = [];

// Tree data provider for the selected files
class FileDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.filterPatterns = ['*.*']; // Default filter pattern
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return {
            label: element.uri.fsPath,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            checked: element.checked
        };
    }

    getChildren(element) {
        if (element) {
            return [];
        }
        return selectedFiles;
    }

    setFilter(filter) {
        this.filterPatterns = filter.split(',').map(pattern => pattern.trim());
        this.refresh();
    }

    filterFiles(files) {
        return files.filter(file => {
            const extension = path.extname(file.uri.fsPath);
            return this.filterPatterns.some(pattern => {
                const regex = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
                return regex.test(extension);
            });
        });
    }
}

// Command for adding files to gpt-contextfiles
const addFilesCommand = vscode.commands.registerCommand('extension.addFilesToGPTContext', () => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
      const workspacePath = workspaceFolders[0].uri.fsPath;
      vscode.workspace.findFiles('**/*', '', 1000).then(files => {
          const fileItems = files.map(file => new FileItem(file));
          selectedFiles.splice(0, selectedFiles.length, ...fileItems);
          fileDataProvider.refresh();
      });
  }
});

// Refresh the file list when workspace changes (file creation, deletion, renaming)
vscode.workspace.onDidChangeWorkspaceFolders(() => {
  vscode.commands.executeCommand('extension.addFilesToGPTContext');
});

vscode.workspace.onDidCreateFiles(() => {
  vscode.commands.executeCommand('extension.addFilesToGPTContext');
});

vscode.workspace.onDidDeleteFiles(() => {
  vscode.commands.executeCommand('extension.addFilesToGPTContext');
});

vscode.workspace.onDidRenameFiles(() => {
  vscode.commands.executeCommand('extension.addFilesToGPTContext');
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
            const selectedFilePaths = selectedFiles
                .filter(file => file.checked)
                .map(file => file.uri.fsPath);

            const fileContents = selectedFilePaths
                .map(filePath => {
                    const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
                    if (document) {
                        const lines = document.getText().split('\n');
                        return `${filePath}\n${lines.join('\n')}`;
                    }
                    return '';
                })
                .join('\n\n');

            panel.webview.html = getWebviewContent(fileContents, question);
        } else if (message.command === 'fileSelectionChanged') {
            const { filePath, checked } = message;
            const file = selectedFiles.find(file => file.uri.fsPath === filePath);
            if (file) {
                file.checked = checked;
            }
        } else if (message.command === 'filterFiles') {
            const { filter } = message;
            fileDataProvider.setFilter(filter);
        }
    });
});

// Helper function to generate the HTML content for the webview panel
function getWebviewContent(fileContents, question) {
    const fileItems = fileDataProvider
        .filterFiles(selectedFiles)
        .map(file => `
            <div>
                <input type="checkbox" id="${file.uri.fsPath}" name="file" value="${file.uri.fsPath}" ${file.checked ? 'checked' : ''}>
                <label for="${file.uri.fsPath}">${file.uri.fsPath}</label>
            </div>
        `)
        .join('\n');

    return `
        <html>
        <body>
            <h1>GPT Context</h1>
            <form id="questionForm">
                <label for="question">Enter your question:</label>
                <input type="text" id="question" name="question" required>
                <button type="submit">Submit</button>
            </form>
            <div>
                <h3>Select Files:</h3>
                <div>
                    <label for="filter">Filter:</label>
                    <input type="text" id="filter" name="filter" value="${fileDataProvider.filterPatterns.join(', ')}">
                    <button id="applyFilter">Apply</button>
                </div>
                ${fileItems}
            </div>
            ${
                fileContents ? `<div><pre>${fileContents}</pre></div>` : ''
            }
            <div><pre>${question ? question : ''}</pre></div>
            <script>
                const vscode = acquireVsCodeApi();

                const form = document.getElementById('questionForm');
                form.addEventListener('submit', event => {
                    event.preventDefault();
                    const question = document.getElementById('question').value;
                    vscode.postMessage({
                        command: 'submitQuestion',
                        text: question
                    });
                });

                const fileCheckboxes = document.querySelectorAll('input[name="file"]');
                fileCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', event => {
                        const filePath = event.target.value;
                        const checked = event.target.checked;
                        vscode.postMessage({
                            command: 'fileSelectionChanged',
                            filePath: filePath,
                            checked: checked
                        });
                    });
                });

                const applyFilterButton = document.getElementById('applyFilter');
                applyFilterButton.addEventListener('click', () => {
                    const filterInput = document.getElementById('filter');
                    const filterValue = filterInput.value;
                    vscode.postMessage({
                        command: 'filterFiles',
                        filter: filterValue
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
