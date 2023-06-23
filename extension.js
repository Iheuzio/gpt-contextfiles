const vscode = require('vscode');
const { Configuration, OpenAIApi } = require("openai");

// move these into the script so that instead of echoing the question and the contents,
// it will echo the question, followed by the answer from the response when the submit button is pressed.
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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

    panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'submitQuestion') {
            const question = message.text;
            const selectedUris = message.selectedUris;

            // Update the selectedFiles array based on the selectedUris
            selectedFiles.forEach(file => {
                file.selected = selectedUris.includes(file.uri.fsPath);
            });

            fileDataProvider.refresh();

            const fileContents = selectedFiles
                .filter(file => file.selected)
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

            // Call OpenAI API with the question and file contents
            try {
                const chatCompletion = await openai.createChatCompletion({
                    model: "gpt-3.5-turbo-16k",
                    messages: [
                        { role: "system", content: "Answer the coding questions, only provide the code and documentation, explaining the solution after providing the code." },
                        { role: "user", content: question },
                        { role: "assistant", content: fileContents }
                    ],
                });

                // Extract the answer from the OpenAI response
                const answer = chatCompletion.data.choices[0].message.content;

                // Update the webview content to display only the OpenAI response
                panel.webview.html = getWebviewContent(answer, question);
            } catch (error) {
                // Handle any errors from the OpenAI API
                console.error("Failed to get OpenAI response:", error);
                panel.webview.html = getWebviewContent(`Failed to get response from OpenAI API. Error: ${error.message}`, question);
            }
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
function getWebviewContent(apiResponse = '', question = '') {
    const fileList = selectedFiles
        .map(
            file =>
                `<div><input type="checkbox" data-uri="${file.uri.fsPath}" ${
                    file.selected ? 'checked' : ''
                } onchange="toggleFileSelection('${file.uri.fsPath}')" /> ${file.uri.fsPath}</div>`
        )
        .join('');

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
                    apiResponse ? `<div><pre>${apiResponse}</pre></div>` : ''
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
                      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                      const selectedUris = [];
                      checkboxes.forEach(checkbox => {
                          if (checkbox.checked) {
                              const uri = checkbox.getAttribute('data-uri');
                              selectedUris.push(uri);
                          }
                      });
                      vscode.postMessage({
                          command: 'submitQuestion',
                          text: question,
                          selectedUris: selectedUris
                      });
                  });
              </script>
          </body>
          </html>
      `;
}


// Activates the extension
function activate(context) {
    context.subscriptions.push(addFilesCommand);
    context.subscriptions.push(openGPTContextPanelCommand);
    context.subscriptions.push(refreshSelectedFilesCommand);
    context.subscriptions.push(clearSelectedFilesCommand);
    context.subscriptions.push(refreshFilesCommand);
    vscode.window.registerTreeDataProvider('selectedFiles', fileDataProvider);

const provider = {
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.html = getWebviewContent();
        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'toggleFileSelection') {
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
                webviewView.webview.html = getWebviewContent();
            } else if (message.command === 'refreshFiles') {
                fileDataProvider.refresh();
                webviewView.webview.html = getWebviewContent();
            } else if (message.command === 'submitQuestion') {
                const question = message.text;
                const selectedUris = message.selectedUris;

                // Update the selectedFiles array based on the selectedUris
                selectedFiles.forEach(file => {
                    file.selected = selectedUris.includes(file.uri.fsPath);
                });

                fileDataProvider.refresh();

                const fileContents = selectedFiles
                    .filter(file => file.selected)
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

                // Call OpenAI API with the question and file contents
                try {
                    const chatCompletion = await openai.createChatCompletion({
                        model: "gpt-3.5-turbo-16k",
                        messages: [
                            { role: "system", content: "Answer the coding questions, only provide the code and documentation, explaining the solution after providing the code." },
                            { role: "user", content: question },
                            { role: "assistant", content: fileContents }
                        ],
                    });

                    // Extract the answer from the OpenAI response
                    const answer = chatCompletion.data.choices[0].message.content;

                    // Update the webview content to display only the OpenAI response
                    webviewView.webview.html = getWebviewContent(answer, question);
                } catch (error) {
                    // Handle any errors from the OpenAI API
                    console.error("Failed to get OpenAI response:", error);
                    webviewView.webview.html = getWebviewContent(`Failed to get response from OpenAI API. Error: ${error.message}`, question);
                }
            }
        });
    }
};

context.subscriptions.push(vscode.window.registerWebviewViewProvider('gpt-context-sidebar', provider));

}


exports.activate = activate;
