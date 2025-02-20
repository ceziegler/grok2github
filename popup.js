let currentCodeBlocks = [];

document.getElementById('saveButton').addEventListener('click', () => {
  const token = document.getElementById('tokenInput').value;
  chrome.storage.sync.set({ githubToken: token }, () => {
    alert('Token saved successfully!');
  });
});

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
    input.value = `codefile${index + 1}`; // Default value
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

chrome.storage.sync.get(['githubToken'], (result) => {
  if (result.githubToken) {
    document.getElementById('tokenInput').value = result.githubToken;
  }
});

document.getElementById('saveToken').addEventListener('click', async () => {
  const token = document.getElementById('tokenInput').value;
  try {
    await chrome.runtime.sendMessage({
      action: 'saveToken',
      token: token
    });
    // Clear the input field after successful save
    document.getElementById('tokenInput').value = '';
    alert('Token saved successfully!');
  } catch (error) {
    alert('Failed to save token: ' + error.message);
  }
});

async function updateTokenStatus() {
  try {
    const isValid = await chrome.runtime.sendMessage({ action: 'checkToken' });
    const tokenInput = document.getElementById('tokenInput');
    const statusElement = document.getElementById('tokenStatus') || createStatusElement();
    
    if (isValid) {
      statusElement.textContent = '✓ Token valid';
      statusElement.style.color = 'green';
      tokenInput.style.display = 'none'; // Hide the input when token is valid
    } else {
      statusElement.textContent = '⚠ Token required';
      statusElement.style.color = 'red';
      tokenInput.style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking token status:', error);
  }
}

function createStatusElement() {
  const statusElement = document.createElement('div');
  statusElement.id = 'tokenStatus';
  document.getElementById('tokenInput').parentNode.insertBefore(statusElement, document.getElementById('tokenInput'));
  return statusElement;
}

document.addEventListener('DOMContentLoaded', updateTokenStatus);