import { GenericJobAdapter } from '../adapters/generic.adapter';

const adapter = new GenericJobAdapter();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_JOB_DETAILS') {
    try {
      const data = adapter.extract();
      sendResponse({ success: true, data });
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});
