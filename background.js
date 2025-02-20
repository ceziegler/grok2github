// Listens for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only accept messages from our extension
  if (!sender.id || sender.id !== chrome.runtime.id) {
    return;
  }

  if (request.action === 'extractCodeBlocks') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs?.[0]?.id) {
        sendResponse({ error: 'No active tab available' });
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: extractCodeBlocks
      }, (results) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: 'Failed to execute script' });
        } else if (results?.[0]?.result) {
          sendResponse({ codeBlocks: results[0].result });
        } else {
          sendResponse({ error: 'No code blocks found' });
        }
      });
    });
    return true;
  } else if (request.action === 'createRepo') {
    const { repoName, files } = request;
    chrome.storage.local.get(['githubToken'], async (result) => {
      try {
        if (!result.githubToken) {
          chrome.runtime.sendMessage({ 
            type: 'showAlert', 
            message: 'Please set your GitHub token first'
          });
          sendResponse({ error: 'Token not configured' });
          return;
        }
        
        const response = await createGitHubRepo(files, result.githubToken, repoName);
        sendResponse({ success: true, message: response.message });
      } catch (error) {
        sendResponse({ error: 'Repository creation failed' });
      }
    });
    return true;
  }
});

// Extracts code blocks from the current page
function extractCodeBlocks() {
  const safeHostname = window.location.hostname.replace(/[^a-z0-9.-]/gi, '');
  const selectorMap = {
    "default": 'div[class^="message-bubble"]',
    "x.com": 'div[style^="display: block;"]',
  };
  const subSelectorMap = {
    "default": 'code',
    "x.com": 'pre > code[class^="language-"], code[class^="language-"]'
  };

  const selector = selectorMap[safeHostname] || selectorMap["default"];
  const subSelector = subSelectorMap[safeHostname] || subSelectorMap["default"];
  
  const codeElements = document.querySelectorAll(selector);
  if (!codeElements.length) return [];
  
  const lastCodeElement = codeElements[codeElements.length - 1];
  const subCodeElements = lastCodeElement?.querySelectorAll(subSelector) || [];
  
  return Array.from(subCodeElements)
    .map(el => el.textContent.trim())
    .filter(code => code.length > 0);
}

// Creates a new GitHub repository
async function createGitHubRepo(files, token, repoName) {
  try {
    if (!token || typeof token !== 'string' || token.length < 40) {
      throw new Error('Invalid token');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };

    const createResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repoName,
        auto_init: false,
        private: true
      })
    });

    if (!createResponse.ok) {
      throw new Error('Repository creation failed');
    }

    const username = await getUsername(headers);

    for (const { code, filename } of files) {
      if (!isValidFilename(filename)) {
        throw new Error('Invalid filename');
      }

      const contentResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/contents/${encodeURIComponent(filename)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `Add ${filename} from chat`,
            content: btoa(unescape(encodeURIComponent(code))),
            branch: 'main'
          })
        }
      );

      if (!contentResponse.ok) {
        throw new Error('File upload failed');
      }
    }

    chrome.runtime.sendMessage({ 
      type: 'showAlert', 
      message: 'Repository created successfully!' 
    });
    return { success: true, message: 'Repository created successfully' };
  } catch (error) {
    console.error('Repository creation error:', error);
    chrome.runtime.sendMessage({ 
      type: 'showAlert', 
      message: 'Failed to create repository'
    });
    throw error;
  }
}

// Validates the filename
function isValidFilename(filename) {
  const invalidPatterns = /[<>:"/\\|?*\x00-\x1F]|^\.\.?$/;
  return typeof filename === 'string' &&
    filename.length > 0 &&
    filename.length < 256 &&
    !invalidPatterns.test(filename);
}

// Fetches the username from GitHub API
async function getUsername(headers) {
  const response = await fetch('https://api.github.com/user', { headers });
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  const data = await response.json();
  return data.login;
}