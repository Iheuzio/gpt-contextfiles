const vscode = require('vscode');
const { selectedFiles, fileDataProvider, handleQuestionSubmission } = require('./gptContext');
const FileItem = require('./fileItem');
const { getWebviewContent } = require('./webviewPanel');

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


module.exports = {
    addFilesCommand,
    openGPTContextPanelCommand,
    refreshSelectedFilesCommand,
    clearSelectedFilesCommand,
    refreshFilesCommand
};