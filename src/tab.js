export const urlIgnoreList = ['chrome://newtab/', 'chrome://extensions/'];
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
        chrome.storage.sync.get(date, (res) => {
          // if the domain has no data or there is no budget for the domain, return false
          if (
            Object.keys(res).length === 0 ||
            Object.keys(res[date]).length === 0 ||
            budgetedTime === null
          ) {
            resolve(false);
            return;
          }
          const domainTime = res[date][domain];
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
    // console.log(`${this.url} was open for ${timeOpenSec} seconds`);
    this.updateStorage(timeOpenSec);
  }

  async updateStorage(timeOpen) {
    if (
      !this.url ||
      urlIgnoreList.includes(this.url) ||
      (await this.isBlocked())
    ) {
      // if url does not exist or is in urlIgnoreList or isBlocked, then do nothing
    } else {
      const domain = getDomain(this.url);
      const fullDate = new Date().toDateString();
      // get data from storage for current date
      await chrome.storage.sync.get(fullDate, (res) => {
        if (Object.keys(res).length === 0) {
          chrome.storage.sync.set({ [fullDate]: { [domain]: timeOpen } });
        } else {
          let newData = res[fullDate];
          // if date already exists, add the timeOpen to the existing time.
          if (domain in newData) {
            const oldTime = parseFloat(newData[domain]);
            const newTime = oldTime + parseFloat(timeOpen);
            newData[domain] = newTime;
          } else {
            newData[domain] = timeOpen;
          }
          // set the new data to storage
          chrome.storage.sync.set({ [fullDate]: newData });
        }
        // if domain has no data stored, just store the current data
      });
    }
  }
}
