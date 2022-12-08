import { Tab, urlIgnoreList } from './tab';
import { getDomain, getTimeFormat3 } from './calculations';

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

let tabIntervalKeys = {};

let tabToTrack;

async function getBudget(url) {
  const domain = getDomain(url);
  if (domain) {
    let budget = null;
    // get domain data from storage
    const data = await chrome.storage.local.get('budget');
    // if domain has data, get the budget
    if (domain in data['budget']) {
      budget = data['budget'][domain];
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
  let activeState = await chrome.storage.local.get('activeState');

  return activeState.activeState;
}

function blockSite(budget, url) {
  document.body.innerHTML = `
  <div class="block">
      <span style='font-size:120px;'>&#9201;</span>
      <h1> Time's Up!!! </h1>
      <div style='font-size: 100px; margin-bottom: 1rem'>${budget}</div>
      <p>You have used all your time for <b>${url}</b> today.</p>   
      <p>You can access this website tomorrow or you can change the timer in the Web Time Manager chrome extension.</p>   
  </div>
    `;
}

const blockPageCss = `
* {
  font-family: 'Arial' !important;
}

h1 {
    color: #ddd !important;
    font-size: 60px !important;
    font-weight: 400 !important;
}

body {
    background-color: #222 !important; 
    color: #ddd !important; 
    height: 100vh !important; 
    width: 100% !important;
}

body > * {
    margin: 0 !important;
}

b {
    color: rgb(54, 162, 235) !important;
}
.block {
    width: 100% !important;
    height: 100vh !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    flex-direction: column;
    font-size: 20px !important;
}
  
  `;

let timeoutIds = [];

async function blockedSiteCheck(tab) {
  let budget = getTimeFormat3(tab.budget);
  let url = getDomain(tab.url);
  for (let index in timeoutIds) {
    clearTimeout(timeoutIds[index]);
    timeoutIds.splice(index, 1);
  }
  if (await tab.isBlocked()) {
    chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      func: blockSite,
      args: [budget, url],
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
      chrome.storage.local.get(date, (res) => {
        // if there is no budget for the domain or no data for the date
        if (
          Object.keys(res).length === 0 ||
          Object.keys(res[date]).length === 0 ||
          res[date][domain] === undefined
        ) {
          resolve(0);
          return;
        }
        const domainTime = res[date][domain];
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
    // dont record last tab if it is in the ignore list
    if (urlIgnoreList.includes(getDomain(tab.url))) {
    } else {
      chrome.scripting.executeScript({
        target: { tabId: tab.tabId },
        func: addCloseListener,
        args: [tab],
      });
    }
  } else {
  }
}

async function addCloseListener(tab) {
  let onBeforeUnLoadEvent = false;

  window.onunload = window.onbeforeunload = function () {
    if (!onBeforeUnLoadEvent) {
      onBeforeUnLoadEvent = true;
      tab['end'] = Date.now();
      chrome.storage.local.set({ lastTab: tab });
    }
  };
}

async function loadAndStoreLastTab() {
  let lastOpenTab = await chrome.storage.local.get('lastTab');
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

// async function updateTime(tab) {
//   let today = new Date().toDateString();
//   let url = getDomain(tab.url);
//   if (urlIgnoreList.includes(url) || url === 'invalid') {
//     // do nothing
//   } else {
//     let todaysData = await chrome.storage.local.get([today]);
//     if (Object.keys(todaysData).length === 0) {
//       chrome.storage.local.set({ [today]: { [url]: 1 } });
//     } else {
//       todaysData = todaysData[today];
//       let currentTime = todaysData[url];
//       if (currentTime !== undefined) {
//         currentTime++;
//         todaysData[url] = currentTime;
//       } else {
//         todaysData[url] = 1;
//       }
//       chrome.storage.local.set({ [today]: todaysData });
//       console.log(url, currentTime);
//     }
//   }
// }

function deleteTodaysData() {
  let today = new Date().toDateString();
  chrome.storage.local.remove([today]);
}

// deleteTodaysData();
async function storeTabs(activeTabs) {
  let today = new Date().toDateString();
  let todaysData = await chrome.storage.local.get([today]);
  if (Object.keys(todaysData).length === 0) {
    chrome.storage.local.set({ [today]: {} });
  } else {
    for (let i = 0; i < activeTabs.length; i++) {
      let url = getDomain(activeTabs[i].url);
      if (urlIgnoreList.includes(url) || url === 'invalid') {
        // do nothing
      } else {
        let currentTime = todaysData[today][url];
        if (currentTime !== undefined) {
          currentTime++;
          todaysData[today][url] = currentTime;
        } else {
          todaysData[today][url] = 1;
        }
        console.log(url, currentTime);
      }
    }
    chrome.storage.local.set({ [today]: todaysData[today] });
  }
}

function startTrackingTab(tab) {
  let intervalKey = setInterval(() => {
    updateTime(tab);
  }, 1000);

  tabIntervalKeys[tab.tabId] = intervalKey;
}

function stopTrackingTab(tab) {
  clearInterval(tabIntervalKeys[tab.tabId]);
  delete tabIntervalKeys[tab.tabId];

  delete openTabs[tab.tabId];
}

setInterval(async () => {
  let activeTabs = await getActiveTabs();

  storeTabs(activeTabs);
}, 1000);

/*   TAB LISTENERS   */

chrome.idle.setDetectionInterval(15);

chrome.idle.onStateChanged.addListener(async (newState) => {
  //   const tab = await getActiveTab();
  //   console.log(tab.audible);
  //   console.log(newState);
  //   if (!tab.audible) {
  //     if (newState === 'idle') {
  //       //   recordAndCloseTab(lastTab.tabId, lastTab.windowId);
  //       stopTrackingTab(tabToTrack);
  //     }
  //     if (newState === 'active') {
  //       //   lastTab = await createNewTab(tab);
  //       //   checkLastTab(lastTab);
  //       //   blockedSiteCheck(lastTab);
  //       tabToTrack = await createNewTab(tab);
  //       startTrackingTab(tabToTrack);
  //     }
  //   }
});

// // add Listener for page update
// chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
//   //   if (lastTab !== undefined) {
//   //     if (changeInfo.status === 'complete' && lastTab.tabId === tabId) {
//   //       recordAndCloseTab(tabId, tab.windowId);
//   //       lastTab = await createNewTab(tab);
//   //       checkLastTab(lastTab);
//   //       blockedSiteCheck(lastTab);
//   //     }
//   //   } else {
//   //     if (changeInfo.status === 'complete') {
//   //       recordAndCloseTab(tabId, tab.windowId);
//   //       lastTab = await createNewTab(tab);
//   //       checkLastTab(lastTab);
//   //       blockedSiteCheck(lastTab);
//   //     }
//   //   }

//   if (tabToTrack !== undefined) {
//     if (changeInfo.status === 'complete' && tabToTrack.tabId === tabId) {
//       stopTrackingTab(tabToTrack);

//       tabToTrack = await createNewTab(tab);
//       startTrackingTab(tabToTrack);

//       console.log('updated');
//     }
//   }
// });

// // listener for closing a tab to setCloseTime only if the closed tab is the active tab
// chrome.tabs.onRemoved.addListener(async (tabId, info) => {
//   if (tabId in openTabs) {
//     stopTrackingTab(openTabs[tabId]);
//   }
//   console.log('removed');
// });

// chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
//   chrome.tabs.query({ windowId: attachInfo.newWindowId }, (tabs) => {
//     for (let tab of tabs) {
//       if (tab.id in openTabs) {
//         stopTrackingTab(openTabs[tab.id]);
//       }
//     }
//   });
// });

// // listener for changing tabs and then will close previous tab and set new current tab to active tab.
// chrome.tabs.onActivated.addListener(async (tabInfo) => {
//   // check to see if trackActiveOnly is toggled on
//   //   if (trackActiveOnly) {
//   //     // check to make sure there is a tab to close
//   //     if (lastTab !== undefined) {
//   //       // record and close tab
//   //       recordAndCloseTab(lastTab.tabId, tabInfo.windowId);
//   //     }
//   //   }
//   //   // check to see if tab was already open
//   //   if (tabInfo.tabId in openTabs) {
//   //     recordAndCloseTab(tabInfo.tabId, tabInfo.windowId);
//   //   }
//   // let activeTab = await getActiveTab();

//   //   lastTab = await createNewTab(activeTab);
//   //   checkLastTab(lastTab);
//   //   blockedSiteCheck(lastTab);

//   let focusedWindow = await chrome.windows.getLastFocused();
//   if (tabToTrack !== undefined && focusedWindow.id === tabToTrack.windowId) {
//     stopTrackingTab(tabToTrack);
//   }

//   //   if (tabInfo.tabId in openTabs) {
//   //     stopTrackingTab(openTabs[tabInfo.tabId]);
//   //   }
//   let newTab = await chrome.tabs.get(tabInfo.tabId);
//   console.log(newTab.url);
//   //   if (newTab.id in openTabs) {
//   //     //do nothing
//   //   } else {
//   tabToTrack = await createNewTab(newTab);
//   startTrackingTab(tabToTrack);

//   console.log('activated');
//   //   }
// });

// chrome.windows.onCreated.addListener(async () => {
//   //   for (let index in timeoutIds) {
//   //     clearTimeout(timeoutIds[index]);
//   //     timeoutIds.splice(index, 1);
//   //   }
//   //   console.log('on window created listener');
//   //   let allWindows = await chrome.windows.getAll();
//   //   if (allWindows.length === 1) {
//   //     loadAndStoreLastTab();
//   //   }
//   //   let activeTabs = await getActiveTabs();
//   //   activeTabs.forEach(async (tab) => {
//   //     await createNewTab(tab);
//   //   });
//   //   trackActiveOnly = await getActiveState();
//   //   let allWindows = await chrome.windows.getAll();
//   //   if (allWindows.length === 1) {
//   //     loadAndStoreLastTab();
//   //   }
//   //   for (let tab in openTabs) {
//   //     stopTrackingTab(openTabs[tab]);
//   //   }
//   //   let activeTabs = await getActiveTabs();
//   //   activeTabs.forEach(async (tab) => {
//   //     if (!(tab.id in openTabs)) {
//   //       tabToTrack = await createNewTab(tab);
//   //       startTrackingTab(tabToTrack);
//   //     }
//   //   });
//   //   console.log('on window created listener');
//   // trackActiveOnly = await getActiveState();
// });

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({ budget: {} });
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

// chrome.storage.local.remove('activeState');
if (Object.keys(await chrome.storage.local.get('activeState')).length === 0) {
  console.log('setting active state');
  chrome.storage.local.set({ activeState: true });
}
