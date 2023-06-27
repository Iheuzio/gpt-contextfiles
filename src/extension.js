const vscode = require('vscode');
const { addFilesCommand, openGPTContextPanelCommand, refreshSelectedFilesCommand, clearSelectedFilesCommand, refreshFilesCommand } = require('./commands');
const { getWebviewContent } = require('./webviewPanel');
const { selectedFiles, fileDataProvider, handleQuestionSubmission } = require('./gptContext');

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