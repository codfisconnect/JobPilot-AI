document.addEventListener('DOMContentLoaded', async () => {
    const pageTitleEl = document.getElementById('page-title');
    const pageUrlEl = document.getElementById('page-url');
    const btnAnalyze = document.getElementById('btn-analyze');
    const statusDisplay = document.getElementById('status-display');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        pageTitleEl.textContent = tab.title || 'Untitled Page';
        pageUrlEl.textContent = tab.url || 'Unknown URL';
    }
    btnAnalyze.addEventListener('click', async () => {
        btnAnalyze.disabled = true;
        btnAnalyze.textContent = 'Extracting and sending to JobPilot...';
        statusDisplay.innerHTML = '';
        try {
            if (!tab.id)
                throw new Error('No active tab identified');
            // Send extraction request to content script
            chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DETAILS' }, async (response) => {
                if (chrome.runtime.lastError || !response || !response.success) {
                    statusDisplay.innerHTML = `
            <div class="error-msg">
              Unable to read this page structure.<br>Use "Paste JD" fallback inside JobPilot dashboard.
            </div>
          `;
                    btnAnalyze.disabled = false;
                    btnAnalyze.textContent = 'Analyze with JobPilot';
                    return;
                }
                const data = response.data;
                // Post structured content to local backend
                try {
                    const res = await fetch('http://localhost:5000/api/jobs/parse', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rawText: `${data.title}\nat ${data.company}\nLocation: ${data.location}\n\n${data.description}`,
                            sourceType: 'extension',
                            sourceUrl: data.sourceUrl
                        })
                    });
                    const result = await res.json();
                    if (result.success) {
                        statusDisplay.innerHTML = `
              <div class="status-msg">
                ✓ Job successfully sent to JobPilot!<br>
                Open dashboard to view match evaluation.
              </div>
            `;
                        btnAnalyze.textContent = 'Job Synced!';
                    }
                    else {
                        throw new Error(result.error || 'Server error');
                    }
                }
                catch (serverErr) {
                    statusDisplay.innerHTML = `
            <div class="error-msg">
              JobPilot Backend offline (http://localhost:5000). Start backend server first.
            </div>
          `;
                    btnAnalyze.disabled = false;
                    btnAnalyze.textContent = 'Try Again';
                }
            });
        }
        catch (err) {
            statusDisplay.innerHTML = `<div class="error-msg">${err.message}</div>`;
            btnAnalyze.disabled = false;
            btnAnalyze.textContent = 'Analyze with JobPilot';
        }
    });
});
