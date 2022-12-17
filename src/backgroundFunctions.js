'use strict';
import { getDomain, getTimeFormat3 } from './calculations';
import { urlIgnoreList } from './background';
const httpRegEx = /(?:https\:\/\/|http\:\/\/)(.*)/;

//get all tabs
export async function getAllTabs() {
  let queryOptions = {};
  let tabs = await chrome.tabs.query(queryOptions);

  return tabs;
}

// get all active tabs
export async function getActiveTabs() {
  let queryOptions = { active: true };
  let tabs = await chrome.tabs.query(queryOptions);

  return tabs;
}

// get active tab in focused window
export async function getActiveTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };

  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

// block html and css
function blockHTML(budget, url) {
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

// inject script into current tab to block the site
async function blockSite(url, tab) {
  let budget = getTimeFormat3(await getBudget(url));

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: blockHTML,
    args: [budget, url],
  });
  chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    css: blockPageCss,
  });
}

// get the budget of the provided url
async function getBudget(url) {
  let budget = null;
  // get domain data from storage
  const data = await chrome.storage.local.get('budget');

  if (data['budget'] !== undefined) {
    if (url in data['budget']) {
      budget = data['budget'][url];
    }

    return budget;
  }

  chrome.storage.local.set({ budget: {} });
  return null;
}

// function that will return true/false on if the site is blocked.
export async function isBlocked(url) {
  let date = new Date().toDateString();
  let budgetedTime = await getBudget(url);
  let promise = new Promise((resolve) => {
    // get stored data for domain
    chrome.storage.local.get(date, (res) => {
      // if the domain has no data or there is no budget for the domain, return false
      if (
        Object.keys(res).length === 0 ||
        Object.keys(res[date]).length === 0 ||
        budgetedTime === null
      ) {
        resolve(false);
        return;
      }
      const domainTime = res[date][url];
      // check to see if current day time spent at domain is greater than budgeted time.  if so return true
      if (domainTime > budgetedTime) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
  let result = await promise;
  return result;
}

// function that will store in local storage all tabs that are active
export async function storeTabs(activeTabs) {
  let today = new Date().toDateString();
  let todaysData = await chrome.storage.local.get([today]);
  if (Object.keys(todaysData).length === 0) {
    chrome.storage.local.set({ [today]: {} });
  } else {
    for (let i = 0; i < activeTabs.length; i++) {
      let url = getDomain(activeTabs[i].url);
      let isHttp = httpRegEx.test(activeTabs[i].url);
      if (!isHttp || url === 'invalid' || urlIgnoreList.includes(url)) {
        // do nothing
      } else {
        if ((await isBlocked(url)) === false) {
          let currentTime = todaysData[today][url];
          if (currentTime !== undefined) {
            currentTime++;
            todaysData[today][url] = currentTime;
          } else {
            todaysData[today][url] = 1;
          }
          console.log(url, currentTime);
        } else {
          console.log(url + ' is blocked');
          blockSite(url, activeTabs[i]);
        }
      }
    }
    chrome.storage.local.set({ [today]: todaysData[today] });
  }
}

//  function that will store the current local storage to the sync storage
export async function storeDataToSyncStorage() {
  let localData = await chrome.storage.local.get(null);
  for (let key in localData) {
    chrome.storage.sync.set({ [key]: localData[key] });
  }
  console.log('sync storage updated');
}

// function that loads the sync storage into the local storage
export async function getDataFromSyncStorage() {
  let syncData = await chrome.storage.sync.get(null);
  for (let key in syncData) {
    chrome.storage.local.set({ [key]: syncData[key] });
  }
}
