const vscode = require('vscode');
const FileItem = require('./fileItem.js');

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

module.exports = {
    FileDataProvider,
    selectedFiles
};
