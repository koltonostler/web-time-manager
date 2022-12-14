import {
  getActiveTabs,
  getAllTabs,
  storeTabs,
  storeDataToSyncStorage,
  getDataFromSyncStorage,
} from './backgroundFunctions';

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

let trackOptions = {
  syncStorageActive: false,
  trackAllTabs: false,
  idleMediaCheck: true,
  idleTimer: 15,
};

let trackActiveOnly = true;

export let urlIgnoreList = [];

async function getActiveState() {
  let activeState = await chrome.storage.local.get('activeState');

  return activeState.activeState;
}

async function getIgnoreList() {
  let ignoreList = await chrome.storage.local.get('ignoreList');

  return ignoreList.ignoreList;
}

async function getOptions(key) {
  let options = await chrome.storage.local.get('options');

  return options.options[key];
}

trackActiveOnly = await getActiveState();
urlIgnoreList = await getIgnoreList();
trackOptions['syncStorageActive'] = await getOptions('syncStorageActive');
trackOptions['trackAllTabs'] = await getOptions('trackAllTabs');
trackOptions['idleMediaCheck'] = await getOptions('idleMediaCheck');
trackOptions['idleTimer'] = await getOptions('idleTimer');

let trackingInterval;
let timerActive = startTrackingTimer();

export async function startTrackingTimer() {
  trackingInterval = setInterval(async () => {
    if (trackOptions.trackAllTabs) {
      let allTabs = await getAllTabs();
      storeTabs(allTabs);
    } else {
      let activeTabs = await getActiveTabs();
      storeTabs(activeTabs);
    }
  }, 1000);
  return true;
}

export function stopTrackingTimer() {
  clearInterval(trackingInterval);
  return false;
}

/*   TAB LISTENERS   */

chrome.idle.setDetectionInterval(trackOptions.idleTimer);

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

  if (trackOptions.idleMediaCheck) {
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
  } else {
    if (newState === 'idle') {
      if (timerActive) {
        timerActive = stopTrackingTimer();
      }
    }
    if (newState === 'active') {
      if (!timerActive) {
        timerActive = startTrackingTimer();
      }
    }
  }
});

if (trackOptions.syncStorageActive) {
  console.log('sync storage active');
  getDataFromSyncStorage();
  setInterval(() => {
    storeDataToSyncStorage();
  }, 30000);
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({ budget: {} });
  chrome.storage.local.set({ options: trackOptions });
  chrome.storage.local.set({ ignoreList: [] });

  let uninstallUrl = 'https://forms.gle/PRjZvdV2J2VSPpKE7';

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.runtime.setUninstallURL(uninstallUrl, () => {
      console.log('uninstall url set');
    });
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if ('trackActive' in request) {
    trackActiveOnly = request.trackActive;
    sendResponse({ activeState: trackActiveOnly });
  } else if (request.msg === 'getActiveState') {
    sendResponse({ activeState: trackActiveOnly });
  } else if (request.msg === 'getIgnoreList') {
    sendResponse({ ignoreList: urlIgnoreList });
  } else if ('ignoreList' in request) {
    urlIgnoreList = request.ignoreList;
  } else if (request.msg === 'getOptions') {
    sendResponse({ options: trackOptions });
  } else if ('options' in request) {
    trackOptions = request.options;
    chrome.idle.setDetectionInterval(trackOptions.idleTimer);
  }

  // Note: Returning true is required here!
  //  ref: http://stackoverflow.com/questions/20077487/chrome-extension-message-passing-response-not-sent
  return true;
});

if (Object.keys(await chrome.storage.local.get('options')).length === 0) {
  console.log('initializing options');
  chrome.storage.local.set({ options: trackOptions });
}
if (Object.keys(await chrome.storage.local.get('ignoreList')).length === 0) {
  console.log('initializing ignoreList');
  chrome.storage.local.set({ ignoreList: [] });
}
