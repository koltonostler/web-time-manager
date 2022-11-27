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

const urlIgnoreList = ['chrome://newtab/'];

const openTabs = {};

let trackActiveOnly = true;
let lastTab;

// setup Tab class
class Tab {
  // constructor for class
  constructor(tabId, windowId, url, icon, audible, budget) {
    this.tabId = tabId;
    this.windowId = windowId;
    this.url = url;
    this.icon = icon;
    this.isAudible = audible;
    this.budget = budget;
    this.timeStamp = new Date().toDateString();
    this.start = Date.now();
    this.end = null;
  }

  // function that will return true/false on if the site is blocked.
  async isBlocked() {
    let domain = getDomain(this.url);
    let date = this.timeStamp;
    let budgetedTime = this.budget;
    let promise = new Promise((resolve) => {
      if (domain) {
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
          if (domainTime > budgetedTime) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    });
    let result = await promise;
    return result;
  }

  setStartTime() {
    this.start = Date.now();
  }

  setCloseTime() {
    this.end = Date.now();
    this.calcTimeOpen();
  }

  // function that calculates the time the current tab was open for using start and end times
  calcTimeOpen() {
    const timeOpenMilli = this.end - this.start;
    const timeOpenSec = timeOpenMilli / 1000;
    console.log(`${this.url} was open for ${timeOpenSec} seconds`);
    this.updateStorage(timeOpenSec);
  }

  //  function that will update storage with the data from calcTimeOpen;
  async updateStorage(timeOpen) {
    if (
      !this.url ||
      urlIgnoreList.includes(this.url) ||
      (await this.isBlocked())
    ) {
      // if url does not exist or is in urlIgnoreList or isBlocked, then do nothing
    } else {
      const domain = getDomain(this.url);
      // get data from storage for current domain
      await chrome.storage.sync.get(domain, (res) => {
        const fullDate = new Date().toDateString();
        // if domain has no data stored, just store the current data
        if (Object.keys(res).length === 0) {
          chrome.storage.sync.set({ [domain]: { [fullDate]: timeOpen } });
        } else {
          let newData = res[domain];
          // if date already exists, add the timeOpen to the existing time.
          if (fullDate in newData) {
            const oldTime = parseFloat(res[domain][fullDate]);
            const newTime = oldTime + parseFloat(timeOpen);
            newData[fullDate] = newTime;
          } else {
            newData[fullDate] = timeOpen;
          }
          // set the new data to storage
          chrome.storage.sync.set({ [domain]: newData });
        }
      });
    }
  }
}

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
// function that verifies the url is valid and returns the domain.
function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    return domain;
  } catch (err) {
    return 'hello';
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

async function blockedSiteCheck(tab) {
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
    return true;
  }
  return false;
}

/*   TAB LISTENERS   */

// add Listener for page update
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    recordAndCloseTab(tabId, tab.windowId);
    lastTab = await createNewTab(tab);
    blockedSiteCheck(lastTab);
  }
});

// listener for closing a tab to setCloseTime only if the closed tab is the active tab
chrome.tabs.onRemoved.addListener((tabId, info) => {
  recordAndCloseTab(tabId, info.windowId);
});
// listener for changing tabs and then will close previous tab and set new current tab to active tab.
chrome.tabs.onActivated.addListener(async (tabInfo) => {
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

  blockedSiteCheck(lastTab);
});

// chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
// 	console.log(detachInfo);
// 	chrome.windows.get(detachInfo.oldWindowId, { populate: true }, async () => {
// 		let activeTabs = await chrome.tabs.query({ active: true });

// 		console.log(activeTabs);
// 	});
// });

chrome.windows.onCreated.addListener(async () => {
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
