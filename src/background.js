import {
  getActiveTabs,
  getAllTabs,
  storeTabs,
  storeDataToSyncStorage,
  getDataFromSyncStorage,
  isBlocked,
} from './backgroundFunctions';
import { getDomain } from './calculations';

/* function to keep persistant background in manifest v3 */
const onUpdate = (tabId, info, tab) =>
  /^https?:/.test(info.url) && findTab([tab]);
findTab();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    setTimeout(() => port.disconnect(), 250e3);
    port.onDisconnect.addListener(() => findTab());
  }
});
async function findTab(tabs) {
  if (chrome.runtime.lastError) {
    /* tab was closed before setTimeout ran */
  }
  for (const { id: tabId } of tabs ||
    (await chrome.tabs.query({ url: '*://*/*' }))) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: connect,
      });
      chrome.tabs.onUpdated.removeListener(onUpdate);
      return;
    } catch (activeInfo) {}
  }
  chrome.tabs.onUpdated.addListener(onUpdate);
}
function connect() {
  chrome.runtime
    .connect({ name: 'keepAlive' })
    .onDisconnect.addListener(connect);
}

let trackingInterval;
let syncStorageActive = false;
let timerActive = startTrackingTimer();

export async function startTrackingTimer() {
  trackingInterval = setInterval(async () => {
    if (trackActiveOnly) {
      let activeTabs = await getActiveTabs();
      storeTabs(activeTabs);
    } else {
      let allTabs = await getAllTabs();
      storeTabs(allTabs);
    }
  }, 1000);
  return true;
}

export function stopTrackingTimer() {
  clearInterval(trackingInterval);
  return false;
}

let trackActiveOnly = true;

async function getActiveState() {
  let activeState = await chrome.storage.local.get('activeState');

  return activeState.activeState;
}

trackActiveOnly = await getActiveState();

/*   TAB LISTENERS   */
// set idle timer to 1min
let idleTimer = 60;

chrome.idle.setDetectionInterval(idleTimer);

chrome.idle.onStateChanged.addListener(async (newState) => {
  let audible = false;

  const activeTabs = await getActiveTabs();
  for (let tab in activeTabs) {
    if (activeTabs[tab].audible) {
      audible = true;
    }
  }
  console.log(audible);
  console.log(newState);

  if (!audible) {
    if (newState === 'idle') {
      if (timerActive) {
        timerActive = stopTrackingTimer();
      }
    }
  }
  if (newState === 'active') {
    if (!timerActive) {
      timerActive = startTrackingTimer();
    }
  }
});

if (syncStorageActive) {
  console.log('sync storage active');
  getDataFromSyncStorage();
  setInterval(() => {
    storeDataToSyncStorage();
  }, 30000);
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({ budget: {} });
  let installUrl = chrome.runtime.getURL('onboarding.html');
  let uninstallUrl = 'https://forms.gle/PRjZvdV2J2VSPpKE7';

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: installUrl }, function (tab) {
      console.log('new install tab created');
    });
    chrome.runtime.setUninstallURL(uninstallUrl, () => {
      console.log('uninstall url set');
    });
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if ('trackActive' in request) {
    trackActiveOnly = request.trackActive;
  }
  sendResponse({ activeState: trackActiveOnly });

  // Note: Returning true is required here!
  //  ref: http://stackoverflow.com/questions/20077487/chrome-extension-message-passing-response-not-sent
  return true;
});

// chrome.storage.local.remove('activeState');
if (Object.keys(await chrome.storage.local.get('activeState')).length === 0) {
  console.log('setting active state');
  chrome.storage.local.set({ activeState: true });
}
