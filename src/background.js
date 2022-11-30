import { Tab, urlIgnoreList } from './tab';
import { getDomain } from './calculations';

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

const openTabs = {};

let trackActiveOnly = true;
let lastTab;

async function getBudget(url) {
  const domain = getDomain(url);
  if (domain) {
    let budget = null;
    // get domain data from storage
    const data = await chrome.storage.sync.get(domain);
    // if domain has data, get the budget
    if (data[domain]) {
      if ('budget' in data[domain]) {
        budget = data[domain]['budget'];
      }
    }
    return budget;
  }
}

// gets the active tab.
async function getActiveTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

// get all active tabs
async function getActiveTabs() {
  let queryOptions = { active: true };
  let tabs = await chrome.tabs.query(queryOptions);
  return tabs;
}

async function createNewTab(tab) {
  let budget = await getBudget(tab.url);
  let currentTab = new Tab(
    tab.id,
    tab.windowId,
    tab.url,
    tab.favIconUrl,
    tab.audible,
    budget
  );
  openTabs[tab.id] = currentTab;
  return currentTab;
}
// function that will record the tab and delete it from the openTabs object
function recordAndCloseTab(tabId, windowId) {
  if (tabId in openTabs && openTabs[tabId].windowId === windowId) {
    openTabs[tabId].setCloseTime();
    delete openTabs[tabId];
  }
}

async function getActiveState() {
  let activeState = await chrome.storage.sync.get('activeState');

  return activeState.activeState;
}

function blockSite(budget, url) {
  document.body.innerHTML = `<h1 class='block'> ${url} is blocked!!! </h1>
                                <p>You have exceeded your budget of ${
                                  budget / 60
                                } min.</p>  
    
    `;
}

const blockPageCss =
  'body {background-color: black !important; color: white !important}';

let timeoutIds = [];

async function blockedSiteCheck(tab) {
  for (let index in timeoutIds) {
    clearTimeout(timeoutIds[index]);
    timeoutIds.splice(index, 1);
  }
  if (await tab.isBlocked()) {
    chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      func: blockSite,
      args: [tab.budget, tab.url],
    });
    chrome.scripting.insertCSS({
      target: { tabId: tab.tabId },
      css: blockPageCss,
    });
  } else if (tab.budget !== null) {
    let domain = getDomain(tab.url);
    let date = tab.timeStamp;
    let budgetedTime = tab.budget;
    let promise = new Promise((resolve) => {
      // get stored data for domain
      chrome.storage.sync.get(domain, (res) => {
        // if the domain has no data or there is no budget for the domain, return false
        if (
          Object.keys(res).length === 0 ||
          Object.keys(res[domain]).length === 0 ||
          budgetedTime === null
        ) {
          resolve(false);
          return;
        }
        const domainTime = res[domain][date];
        // check to see if current day time spent at domain is greater than budgeted time.  if so return true
        resolve(domainTime);
      });
    });
    let domainTime = await promise;
    let timeUntilBlock = (budgetedTime - domainTime) * 1000;

    console.log(timeUntilBlock);
    let timeoutId = setTimeout(async () => {
      chrome.scripting.executeScript({
        target: { tabId: tab.tabId },
        func: blockSite,
        args: [tab.budget, tab.url],
      });
      chrome.scripting.insertCSS({
        target: { tabId: tab.tabId },
        css: blockPageCss,
      });
      tab.setCloseTime();
    }, timeUntilBlock);
    timeoutIds.push(timeoutId);
  }
}

async function checkLastTab(tab) {
  let allTabs = await chrome.tabs.query({});

  if (allTabs.length === 1) {
    console.log(tab.url);
    if (tab.url?.startsWith('chrome://')) {
    } else {
      console.log(true);
      chrome.scripting.executeScript({
        target: { tabId: tab.tabId },
        func: addCloseListener,
        args: [tab],
      });
    }
  }
}

async function addCloseListener(tab) {
  let onBeforeUnLoadEvent = false;

  window.onunload = window.onbeforeunload = function () {
    if (!onBeforeUnLoadEvent) {
      onBeforeUnLoadEvent = true;
      tab['end'] = Date.now();
      chrome.storage.sync.set({ lastTab: tab });
    }
  };
}

async function loadAndStoreLastTab() {
  let lastOpenTab = await chrome.storage.sync.get('lastTab');
  lastOpenTab = lastOpenTab['lastTab'];
  let tabToStore = new Tab(
    lastOpenTab.tabId,
    lastOpenTab.windowId,
    lastOpenTab.url,
    lastOpenTab.icon,
    lastOpenTab.isAudible,
    lastOpenTab.budget
  );

  tabToStore.start = lastOpenTab.start;
  tabToStore.end = lastOpenTab.end;
  tabToStore.timeStamp = lastOpenTab.timeStamp;

  tabToStore.calcTimeOpen();
}

/*   TAB LISTENERS   */

// add Listener for page update
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('update listener');
  if (changeInfo.status === 'complete') {
    recordAndCloseTab(tabId, tab.windowId);
    lastTab = await createNewTab(tab);
    checkLastTab(lastTab);
    blockedSiteCheck(lastTab);
  }
});

// listener for computer going to idle state
// chrome.idle.onStateChanged.addListener(async (newState) => {
//   console.log('idle listener');
//   // record and close active tab when state changed to idle
//   if (newState === 'idle') {
//     recordAndCloseTab(lastTab.tabId, lastTab.windowId);
//   }
//   // when waking up from idle, get active tab and see if it is the only open tab and check if site is blocked
//   if (newState === 'active') {
//     let activeTab = await getActiveTab();
//     lastTab = await createNewTab(activeTab);
//     checkLastTab(lastTab);
//     blockedSiteCheck(lastTab);
//   }
// });

// listener for closing a tab to setCloseTime only if the closed tab is the active tab
chrome.tabs.onRemoved.addListener((tabId, info) => {
  console.log('remove listener');
  recordAndCloseTab(tabId, info.windowId);
  checkLastTab(lastTab);
});
// listener for changing tabs and then will close previous tab and set new current tab to active tab.
chrome.tabs.onActivated.addListener(async (tabInfo) => {
  console.log('on activated listener');
  // check to see if trackActiveOnly is toggled on
  if (trackActiveOnly) {
    // check to make sure there is a tab to close
    if (lastTab !== undefined) {
      // record and close tab
      recordAndCloseTab(lastTab.tabId, tabInfo.windowId);
    }
  }
  // check to see if tab was already open
  if (tabInfo.tabId in openTabs) {
    recordAndCloseTab(tabInfo.tabId, tabInfo.windowId);
  }
  let activeTab = await getActiveTab();

  lastTab = await createNewTab(activeTab);
  checkLastTab(lastTab);
  blockedSiteCheck(lastTab);
});

chrome.windows.onCreated.addListener(async () => {
  for (let index in timeoutIds) {
    clearTimeout(timeoutIds[index]);
    timeoutIds.splice(index, 1);
  }
  console.log('on window created listener');
  let allWindows = await chrome.windows.getAll();
  if (allWindows.length === 1) {
    loadAndStoreLastTab();
  }
  let activeTabs = await getActiveTabs();
  activeTabs.forEach(async (tab) => {
    await createNewTab(tab);
  });
  trackActiveOnly = await getActiveState();
});

// function that validates if url is valid and returns the full domain from url

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if ('trackActive' in request) {
    trackActiveOnly = request.trackActive;
  }
  sendResponse({ activeState: trackActiveOnly });

  // Note: Returning true is required here!
  //  ref: http://stackoverflow.com/questions/20077487/chrome-extension-message-passing-response-not-sent
  return true;
});
