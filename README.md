# gpt-contextfiles

** currently in development, if you'll like to contribute or provide any feedback check out the [link](https://github.com/Iheuzio/gpt-contextfiles/issues) **

I was annoyed with copying responses into chatgpt and other LLMs for debugging my code across files, so I decided to make an extension that will do that.

You simply right click each file you want to pass through, check or uncheck the checkbox, then enter your question and pass along the response over the api to your LLM.

# Installation

Add your api key to `OPENAI_API_KEY` for your windows/linux environment variable (tested with system variable)

# Features

Clear -> Clears the files currently available

Submit -> Submits the query to the api

Refresh -> refreshes the window so that all new files will be available for that session.

User must ctrl+shift+p and click on the `Open GPT Context Panel` option and then add files (before or after), then input the question. 

# Examples

We can select two files we want to pass through, however we can uncheck one of them for later debugging and enter our question:

```
What does this do?
c:\dev\test\gpt-contextfiles-test\program.js:
\```
	window.alert("Hello World!")
\```

Selected Files:
[x] c:\dev\test\gpt-contextfiles-test\program.js
[ ] c:\dev\test\gpt-contextfiles-test\program2.js
```

Expected Ouput:

```
The window.alert() method is a built-in JavaScript function that displays an alert box with a specified message and an OK button. In this case, the message is "Hello World!".
```
