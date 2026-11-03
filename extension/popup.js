/**
 * ApplyPilot AI — Popup Script
 * Orchestrates extraction, API transmission to ApplyPilot web service, and triggering autofill.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const originInput = document.getElementById('webOriginInput');
  const appIdInput = document.getElementById('appIdInput');
  const extractBtn = document.getElementById('extractBtn');
  const autofillBtn = document.getElementById('autofillBtn');
  const statusBox = document.getElementById('statusBox');

  // Load saved settings from Chrome storage
  chrome.storage.local.get(['webOrigin', 'activeAppId'], (res) => {
    if (res.webOrigin) originInput.value = res.webOrigin;
    if (res.activeAppId) appIdInput.value = res.activeAppId;
    if (res.activeAppId) {
      checkExistingAutofill(res.webOrigin || originInput.value, res.activeAppId);
    }
  });

  function setStatus(msg, isError = false) {
    statusBox.style.display = 'block';
    statusBox.className = isError ? 'status error' : 'status';
    statusBox.innerText = msg;
  }

  async function checkExistingAutofill(origin, appId) {
    if (!appId || !origin) return;
    try {
      const res = await fetch(`${origin}/api/applications/autofill?applicationId=${encodeURIComponent(appId)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok && json.data && Array.isArray(json.data.fields) && json.data.fields.length > 0) {
        const approvedCount = json.data.fields.filter((f) => f.status === 'reviewed').length;
        autofillBtn.style.display = 'flex';
        setStatus(`Found ${json.data.fields.length} prepared fields (${approvedCount} approved for autofill).`);
      }
    } catch {
      // Ignore network ping errors on load
    }
  }

  // Ensure content script is injected into tab (works on demand with activeTab & scripting permissions)
  async function ensureContentScriptInjected(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    } catch (err) {
      // If already injected or restricted page (chrome://, etc.)
      console.warn('Script injection attempt:', err.message);
    }
  }

  // 1. EXTRACT ACTION
  extractBtn.addEventListener('click', async () => {
    const origin = originInput.value.trim().replace(/\/+$/, '');
    const appId = appIdInput.value.trim();

    if (!origin) {
      setStatus('Please enter the ApplyPilot Web Origin (e.g. http://localhost:3000).', true);
      return;
    }

    if (!appId) {
      setStatus('Please enter your Application ID (e.g. sample-1 or UUID).', true);
      return;
    }

    chrome.storage.local.set({ webOrigin: origin, activeAppId: appId });

    extractBtn.disabled = true;
    setStatus('Connecting to active tab…');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setStatus('Could not access active tab. Open a web application tab first.', true);
      extractBtn.disabled = false;
      return;
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      setStatus('Cannot extract from internal browser settings pages. Open a job application form page.', true);
      extractBtn.disabled = false;
      return;
    }

    await ensureContentScriptInjected(tab.id);
    setStatus('Scanning page for job application form fields…');

    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_FIELDS' }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        const errMsg = chrome.runtime.lastError?.message || response?.error || 'Failed to communicate with page.';
        setStatus(`Extraction error: ${errMsg}. Please refresh the job page and retry.`, true);
        extractBtn.disabled = false;
        return;
      }

      const extractedFields = response.fields || [];
      if (extractedFields.length === 0) {
        setStatus('No standard application form fields detected on this page.', true);
        extractBtn.disabled = false;
        return;
      }

      setStatus(`Found ${extractedFields.length} fields. Sending to ApplyPilot Gemini pipeline…`);

      // Post to ApplyPilot API
      try {
        const apiRes = await fetch(`${origin}/api/applications/autofill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'process_fields',
            applicationId: appId,
            url: response.url || tab.url,
            fields: extractedFields,
          }),
        });

        const json = await apiRes.json();
        if (!apiRes.ok || !json.ok) {
          throw new Error(json.error || `Server responded with ${apiRes.status}`);
        }

        const mappedFields = json.data?.fields || [];
        const approvedCount = mappedFields.filter((f) => f.status === 'reviewed').length;
        const reviewRequiredCount = mappedFields.filter((f) => f.status !== 'reviewed').length;

        setStatus(`Success! Mapped ${mappedFields.length} fields (${approvedCount} approved, ${reviewRequiredCount} require review). Review on ApplyPilot, or autofill approved fields below.`);
        autofillBtn.style.display = 'flex';
      } catch (err) {
        setStatus(`API Error: ${err.message}. Ensure ApplyPilot is running at ${origin} and you are logged in.`, true);
      } finally {
        extractBtn.disabled = false;
      }
    });
  });

  // 2. AUTOFILL ACTION
  autofillBtn.addEventListener('click', async () => {
    const origin = originInput.value.trim().replace(/\/+$/, '');
    const appId = appIdInput.value.trim();

    if (!appId || !origin) {
      setStatus('Missing Web Origin or Application ID.', true);
      return;
    }

    autofillBtn.disabled = true;
    setStatus('Retrieving approved answers from ApplyPilot…');

    try {
      const apiRes = await fetch(`${origin}/api/applications/autofill?applicationId=${encodeURIComponent(appId)}`, {
        credentials: 'include',
      });
      const json = await apiRes.json();
      if (!apiRes.ok || !json.ok || !json.data || !Array.isArray(json.data.fields)) {
        throw new Error(json.error || 'No approved answers found');
      }

      const allFields = json.data.fields;
      // Filter strictly for fields marked 'reviewed' by human candidate
      const approvedFields = allFields.filter((f) => f.status === 'reviewed');

      if (approvedFields.length === 0) {
        setStatus('No fields have been marked "reviewed". Please review and approve answers in ApplyPilot first.', true);
        autofillBtn.disabled = false;
        return;
      }

      setStatus(`Filling ${approvedFields.length} approved fields on page…`);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found.');

      await ensureContentScriptInjected(tab.id);

      chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_FIELDS', mappings: approvedFields }, async (fillRes) => {
        if (chrome.runtime.lastError || !fillRes || !fillRes.ok) {
          const errMsg = chrome.runtime.lastError?.message || fillRes?.error || 'Could not fill tab';
          setStatus(`Autofill failed: ${errMsg}`, true);
          autofillBtn.disabled = false;
          return;
        }

        const { filledCount, skippedCount } = fillRes.result;

        // Determine accurate filling status
        let newStatus = 'analyzed';
        if (filledCount > 0 && skippedCount === 0) {
          newStatus = 'completed';
        } else if (filledCount > 0 && skippedCount > 0) {
          newStatus = 'partially_filled';
        }

        setStatus(`Done! Filled ${filledCount} field(s) (${skippedCount} skipped/preserved/unmatched). Review your answers and submit manually!`);

        // Record autofill status back in ApplyPilot
        await fetch(`${origin}/api/applications/autofill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'save_autofill',
            applicationId: appId,
            fields: allFields,
            autofillStatus: newStatus,
          }),
        }).catch(() => {});

        autofillBtn.disabled = false;
      });
    } catch (err) {
      setStatus(`Autofill error: ${err.message}`, true);
      autofillBtn.disabled = false;
    }
  });
});
