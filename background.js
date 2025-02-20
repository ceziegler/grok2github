chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractCodeBlocks') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: extractCodeBlocks
        }, (results) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ codeBlocks: results[0].result });
          }
        });
      });
      return true; // Indicate async response
    } else if (request.action === 'createRepo') {
      const { repoName, files } = request;
      chrome.storage.sync.get(['githubToken'], (result) => {
        if (!result.githubToken) {
          alert('Please set your GitHub token in the extension popup first!');
          return;
        }
        createGitHubRepo(files, result.githubToken, repoName);
      });
    }
  });
  
  function extractCodeBlocks() {
    const codeElements = document.querySelectorAll('pre > code[class^="language-"], code[class^="language-"]');
    const codeBlocks = [];
    codeElements.forEach((el) => {
      const code = el.textContent.trim();
      if (code) {
        codeBlocks.push(code);
      }
    });
    return codeBlocks;
  }
  
  async function createGitHubRepo(files, token, repoName) {
    try {
      // Basic token validation
      if (!token || typeof token !== 'string' || token.length < 40) {
        throw new Error('Invalid GitHub token format');
      }

      // Use more secure headers
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };

      // Create new repository
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
        const errorData = await createResponse.json();
        throw new Error(`Failed to create repo: ${errorData.message}`);
      }

      const username = await getUsername(headers);

      // Add each file using the provided file names
      for (let i = 0; i < files.length; i++) {
        const { code, filename } = files[i];
        
        // Validate filename to prevent path traversal
        if (!isValidFilename(filename)) {
          throw new Error(`Invalid filename: ${filename}`);
        }

        const contentResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/contents/${encodeURIComponent(filename)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `Add ${filename} from chat`,
            content: btoa(unescape(encodeURIComponent(code))), // Properly handle Unicode characters
            branch: 'main'
          })
        });

        if (!contentResponse.ok) {
          const errorData = await contentResponse.json();
          throw new Error(`Failed to add file ${filename}: ${errorData.message}`);
        }
      }

      // Use a more generic success message that doesn't expose details
      return { success: true, message: 'Repository created successfully' };
    } catch (error) {
      console.error('Error creating repository:', error);
      throw new Error('Failed to create repository. Please check your token and try again.');
    }
  }
  
  // Helper function to validate filenames
  function isValidFilename(filename) {
    // Prevent directory traversal and invalid characters
    const invalidPatterns = /[<>:"/\\|?*\x00-\x1F]|^\.\.?$/;
    return typeof filename === 'string' 
      && filename.length > 0 
      && filename.length < 256 
      && !invalidPatterns.test(filename);
  }
  
  // Update getUsername to use the same headers
  async function getUsername(headers) {
    const response = await fetch('https://api.github.com/user', { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch user information');
    }
    const data = await response.json();
    return data.login;
  }
  