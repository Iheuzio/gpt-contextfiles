const vscode = require('vscode');
const { Configuration, OpenAIApi } = require("openai");
const FileDataProvider = require('./fileDataProvider');
const { getWebviewContent } = require('./webviewPanel');


const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const selectedFiles = FileDataProvider.selectedFiles;
const fileDataProvider = new FileDataProvider.FileDataProvider();

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
                { role: "system", content: "Answer the coding questions, only provide the code and documentation, explaining the solution after providing the code. Put codeblocks inside ``` code ``` with file names above each snippet." },
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

module.exports = {
    handleQuestionSubmission,
    fileDataProvider,
    selectedFiles
};