const vscode = require('vscode');
const { selectedFiles } = require('./fileDataProvider');

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
                width: 90%;
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
                width: 98%;
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
                width: 98%;
            }
    
            .content p {
                font-size: 14px;
                margin: 0;
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
                color: white;
            }
    
            #question-rep {
                font-weight: bold;
                background-color: #2d2d2d;
                word-wrap: wrap;
                border: 1px solid white;
                border-radius: 5px;
                padding: 10px;
            }
    
            div#api-response.content.active {
                background-color: #313131;
            }
    
            #code-block {
                padding: 10px 0 10px 10px; 
                padding-
                border-radius: 5px;
                background-color: black;
                border: none;
                font: inherit;
                color: inherit;
                cursor: pointer;
                outline: inherit;
                width: 98%;
                text-align: left;
                display: inline-block;
                position: relative;
            }

            #copy-button {
                padding: 5px;
                border-radius: 5px;
                background-color: #007acc;
                border: none;
                font: inherit;
                color: #fff;
                cursor: pointer;
                outline: inherit;
                margin: 5px;
                position: absolute;
                top: 0;
                right: 0;
            }

            #copy-button:hover {
                background-color: #fff;
                color: #000;
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
                            <pre id="response">${apiResponse.replace(/```([^```]+)```/g, '<div  id="code-block"><code>$1</code><button onclick="copyCode(event)" id="copy-button">copy</button></div>')}</pre>
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

                function copyCode(event) {
                    event.preventDefault();
                    const codeBlock = event.target.parentNode.querySelector('code');
                
                    if (codeBlock) {
                        const codeText = codeBlock.innerText;
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

module.exports = {
    getWebviewContent
};