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

setInterval(async () => {
  let activeTabs = await getActiveTabs();

  storeTabs(activeTabs);
}, 1000);

let trackActiveOnly = true;

async function getActiveState() {
  let activeState = await chrome.storage.local.get('activeState');

  return activeState.activeState;
}

trackActiveOnly = await getActiveState();

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

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({ budget: {} });
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
