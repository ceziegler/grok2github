let currentCodeBlocks = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  if (request.type === 'showAlert') {
      alert(request.message);
  }
});


document.getElementById('saveButton').addEventListener('click', () => {
  const token = document.getElementById('tokenInput').value;
  try {
    chrome.storage.local.set({ githubToken: token }, () => {
      alert('Token saved successfully!');
    });
  } catch (error) {
    alert('Failed to save token: ' + error.message);
  }
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


// Check for token when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const { githubToken } = await chrome.storage.local.get('githubToken');
  const tokenSection = document.getElementById('tokenSection');
  
  if (!githubToken) {
    tokenSection.classList.remove('hidden');
  } else {
    document.getElementById('tokenInput').value = githubToken;
  }
});

