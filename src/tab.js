const urlIgnoreList = ['chrome://newtab/', 'chrome://extensions/'];
import { getDomain } from './calculations';

export class Tab {
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
