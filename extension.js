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

// Function to handle question submission
async function handleQuestionSubmission(panel, question, selectedUris) {
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
                { role: "user", content: question + "\n" + fileContents},
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
}

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
            await handleQuestionSubmission(panel, message.text, message.selectedUris);
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
                `<div><input type="checkbox" data-uri="${file.uri.fsPath}" ${file.selected ? 'checked' : ''
                } onchange="toggleFileSelection('${file.uri.fsPath}')" /> ${file.uri.fsPath}</div>`
        )
        .join('');

    return `
    <html>

    <head>
        <style>
            .panel {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 50%;
                height: 100%;
                margin: 0 auto;
                background-color: #1e1e1e;
                color: #d4d4d4;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
    
            .textbox {
                width: 100%;
                height: 200px;
                resize: both;
                padding: 10px;
            }
    
            .buttons {
                display: flex;
                justify-content: space-between;
                width: 50%;
            }
    
            .button {
                flex-grow: 1;
                background-color: #007acc;
                color: #fff;
                padding: 10px;
                text-align: center;
                cursor: pointer;
                border: none;
                outline: none;
                font-size: 14px;
            }
    
            #response {
                white-space: pre-wrap;
            }
    
            #file-list {
                margin-top: 20px;
                border
            }
    
            .form-group {
                display: flex;
                flex-direction: column;
                margin-bottom: 20px;
                width: 100%;
            }
    
            .form-group label {
                margin-bottom: 5px;
                font-size: 14px;
            }
    
            .form-group input[type="text"] {
                padding: 10px;
                font-size: 14px;
                border: none;
                outline: none;
                background-color: #2d2d2d;
                color: #d4d4d4;
            }
    
            .form-group input[type="text"]::placeholder {
                color: #d4d4d4;
            }
    
            .form-group .button-options {
                display: flex;
                justify-content: space-between;
                margin-top: 10px;
            }
    
            .form-group .button-options button {
                padding: 10px;
                font-size: 14px;
                border: none;
                outline: none;
                cursor: pointer;
                background-color: #007acc;
                color: #fff;
            }
    
            .form-group .button-options button:hover {
                background-color: #005f8c;
            }
    
            .form-group .button-options button:active {
                background-color: #004d73;
            }
    
            .form-group .button-options button:focus {
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.5);
            }
    
            .file-list {
                margin-top: 20px;
                width: 100%;
            }
    
            .file-list h2 {
                margin-bottom: 10px;
                font-size: 14px;
            }
    
            .file-list .file-item {
                display: flex;
                align-items: center;
                margin-bottom: 5px;
                font-size: 14px;
            }
    
            .file-list .file-item input[type="checkbox"] {
                margin-right: 5px;
            }
    
            .file-list .file-item label {
                margin-bottom: 0;
            }
    
            .file-list .file-item .file-path {
                overflow-wrap: break-word;
            }
    
            .file-list .file-item .file-path:hover {
                text-decoration: underline;
                cursor: pointer;
            }
    
            .file-list .file-item .file-path:active {
                color: #007acc;
            }
    
            .file-list .file-item .file-path:focus {
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.5);
            }
    
            .collapsible {
                background-color: #2d2d2d;
                color: #d4d4d4;
                cursor: pointer;
                padding: 10px;
                width: 100%;
                border: none;
                outline: none;
                text-align: left;
                font-size: 14px;
            }
    
            .collapsible:hover {
                background-color: #3c3c3c;
            }
    
            .collapsible:active {
                background-color: #4c4c4c;
            }
    
            .collapsible:focus {
                box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.5);
            }
    
            .content {
                padding: 0 10px;
                display: none;
                overflow: hidden;
                background-color: #f1f1f1;
                width: 100%;
            }
    
            .content p {
                margin-top: 0;
                font-size: 14px;
            }
    
            .active,
            .collapsible:hover {
                background-color: #555;
            }
    
            .active:after {
                content: "\\2212";
            }
    
            .collapsible:after {
                content: "\\002B";
                color: #d4d4d4;
                font-weight: bold;
                float: right;
                margin-left: 5px;
            }
    
            .active:after {
                content: "\\2212";
            }
    
            .collapsible:after {
                content: "\\002B";
                color: #d4d4d4;
                font-weight: bold;
                float: right;
                margin-left: 5px;
            }
    
            #rendered {
                background-color: #2d2d2d;
                word-wrap: wrap;
                margin-top: 20px;
                border: 1px solid white;
                border-radius: 5px;
                padding: 10px;
            }
    
            #question-rep {
                font-weight: bold;
                background-color: #2d2d2d;
                word-wrap: wrap;
                border: 1px solid white;
                border-radius: 5px;
            }
    
            div#api-response.content.active {
                background-color: #313131;
            }
    
            #code-block {
                padding: 0;
                background: none;
                border: none;
                font: inherit;
                color: inherit;
                cursor: pointer;
                outline: inherit;
                margin: 0;
                width: 100%;
                text-align: left;
            }
        </style>
    </head>
    
    <body class="panel">
        <h1>GPT Context</h1>
        <form id="questionForm">
            <div class="form-group">
                <input type="text" id="question" name="question" placeholder="Enter your question:">
                <div class="button-options">
                    <button type="submit" onclick="submitQuestionApi()">Submit</button>
                    <button type="button" onclick="clearSelectedFiles()">Clear</button>
                    <button type="button" onclick="refreshSelectedFiles()">Refresh</button>
                </div>
            </div>
            <div class="form-group">
                <div class="collapsible" onclick="toggleApiResponse()">
                    API Response
                </div>
                <div class="content" id="api-response">
                    <div id="question-rep">
                        <p>${question ? '> ' + question : null}</p>
                    </div>
                    ${
                    apiResponse ? `
                    <div id="rendered">
                        <p id="responses">
                            <pre id="response">${apiResponse.replace(/```([^```]+)```/g, '<button onclick="copyCode()" id="code-block"><code>$1</code></button>')}</pre>
                        </p>
                    </div>
                    ` : null
                    }
                </div>
            </div>
            <div class="form-group">
                <label for="selected-files">Selected Files:</label>
                <div class="file-list">
                    ${fileList ? fileList : '<p class="no-files">No files selected</p>'}
                </div>
            </div>
            <script>
                
                const vscode = acquireVsCodeApi();
                
                if (${apiResponse !== ''}){
                    toggleApiResponse();
                }

                function copyCode() {
                    event.preventDefault();
                    const codeBlocks = document.getElementsByTagName('code');
                    const selectedCodeBlock = event.target.closest('code');
    
                    if (selectedCodeBlock) {
                        const codeText = selectedCodeBlock.innerText;
                        const dummyTextArea = document.createElement('textarea');
                        dummyTextArea.value = codeText;
                        document.body.appendChild(dummyTextArea);
                        dummyTextArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(dummyTextArea);
    
                        vscode.postMessage({
                            command: 'codeCopied'
                        });
                    }
                }
    
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
    
                function toggleApiResponse() {
                    const apiResponse = document.getElementById('api-response');
                    var response = document.getElementById('responses');
                    if (response === null) {
                        return;
                    }
                    apiResponse.classList.toggle('active');
                    const content = apiResponse;
                    const collapsible = apiResponse.previousElementSibling;
                    if (content.style.display === 'block') {
                        content.style.display = 'none';
                        collapsible.classList.remove('active');
                    } else {
                        content.style.display = 'block';
                        collapsible.classList.add('active');
                    }
                }
    
                const form = document.getElementById('questionForm');
                function submitQuestionApi() {
                    event.preventDefault();
                    if (document.getElementById('question').value === '' || document.getElementById('question').value === null) {
                        return;
                    }
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
                }
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
                    await handleQuestionSubmission(webviewView, message.text, message.selectedUris);
                } else if (message.command === 'codeCopied') {
                    vscode.window.showInformationMessage('Code copied to clipboard');
                }
            });
        }
    };

    context.subscriptions.push(vscode.window.registerWebviewViewProvider('gpt-context-sidebar', provider));

}


exports.activate = activate;
