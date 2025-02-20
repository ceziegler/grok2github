let currentCodeBlocks = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  if (request.type === 'showAlert') {
      alert(request.message);
  }
});

// Saves new GitHub token
document.getElementById('saveButton').addEventListener('click', async () => {
  const token = document.getElementById('tokenInput').value;
  const tokenSection = document.getElementById('tokenSection');

  const isValid = await validateGitHubToken(token);
  if (!isValid) {
    tokenSection.classList.remove('hidden');
    alert('Invalid token. Please try again.');
    return;
  }
  try {
    chrome.storage.local.set({ githubToken: token }, () => {
      tokenSection.classList.add('hidden');
      alert('Token saved successfully!');
    });
  } catch (error) {
    alert('Failed to save token: ' + error.message);
  }
});

// Captures code blocks from the current page
document.getElementById('captureButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'extractCodeBlocks' }, (response) => {
    if (response.error) {
      alert('Error: ' + response.error);
    } else if (response.codeBlocks.length === 0) {
      alert('No code blocks found on this page.');
    } else {
      currentCodeBlocks = response.codeBlocks;
      displayCodeBlocks(response.codeBlocks);
    }
  });
});

// Displays code blocks in the popup
function displayCodeBlocks(codeBlocks) {
  const container = document.getElementById('codeBlocksContainer');
  container.innerHTML = ''; // Clear previous content

  codeBlocks.forEach((code, index) => {
    const snippet = code.split('\n')[0].substring(0, 50) + (code.length > 50 ? '...' : '');
    const pre = document.createElement('pre');
    pre.textContent = snippet;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter file name (e.g., from Grok)';
    input.value = `renameCodeFile${index + 1}`; // Default value
    input.id = `filename-${index}`;

    container.appendChild(pre);
    container.appendChild(input);
  });

  const createButton = document.createElement('button');
  createButton.textContent = 'Create Repository';
  createButton.addEventListener('click', () => {
    const repoName = prompt('Enter repository name:', `chat-code-${Date.now()}`);
    if (repoName === null) return; // User cancelled
    if (!repoName.trim()) {
      alert('Repository name cannot be empty!');
      return;
    }

    const files = currentCodeBlocks.map((code, index) => {
      const filename = document.getElementById(`filename-${index}`).value.trim();
      return { code, filename };
    });

    // Validate file names
    const fileNames = files.map(f => f.filename);
    const uniqueNames = new Set(fileNames);
    if (fileNames.some(name => name === '') || uniqueNames.size < fileNames.length) {
      alert('Please ensure all file names are unique and not empty.');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'createRepo',
      repoName: repoName.trim(),
      files: files
    });
  });

  container.appendChild(createButton);
}

// Function to validate GitHub token
async function validateGitHubToken(token) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
}

// Check for token when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const { githubToken } = await chrome.storage.local.get('githubToken');
  const tokenSection = document.getElementById('tokenSection');
  
  if (!githubToken) {
    tokenSection.classList.remove('hidden');
    return;
  }

  const isValid = await validateGitHubToken(githubToken);
  if (!isValid) {
    tokenSection.classList.remove('hidden');
    // Optionally remove the invalid token
    await chrome.storage.local.remove('githubToken');
  } else {
    tokenSection.classList.add('hidden');
  }
});

