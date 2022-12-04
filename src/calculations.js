'use strict';

export function getTimeFormat(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds - hours * 3600) / 60);
  let sec = totalSeconds - hours * 3600 - min * 60;
  sec = Math.round(sec * 100) / 100;
  sec = sec.toFixed(0);
  let timeFormat = `${hours} hr ${min} min`;
  if (hours < 1) {
    if (min < 1) {
      timeFormat = `${sec} sec`;
    } else {
      timeFormat = `${min} min ${sec} sec`;
    }
  }
  return timeFormat;
}

export function getTimeFormat2(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds - hours * 3600) / 60);
  let sec = totalSeconds - hours * 3600 - min * 60;
  sec = Math.round(sec * 100) / 100;
  sec = sec.toFixed(0);
  let timeFormat = `${hours}hr ${min}m`;
  if (hours < 1) {
    timeFormat = `${min}m`;
    if (min === 0) {
      timeFormat = '';
    }
  } else if (min === 0) {
    timeFormat = `${hours}hr`;
  }
  return timeFormat;
}

export function getTimeFormat3(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds - hours * 3600) / 60);
  let sec = totalSeconds - hours * 3600 - min * 60;
  sec = Math.round(sec * 100) / 100;
  sec = sec.toFixed(0);
  let timeFormat = `${hours}h ${min}m`;
  if (hours >= 1 && min === 0) {
    timeFormat = `${hours}h`;
  } else if (hours < 1) {
    timeFormat = `${min}m`;
  }

  return timeFormat;
}

export async function getAllData() {
  const response = await chrome.storage.sync.get(null);
  return response;
}

// function that verifies the url is valid and returns the domain.
export function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    return domain;
  } catch (err) {
    return 'hello';
  }
}

export function createDateObject(date) {
  const dateInfo = {};
  dateInfo['fullDate'] = new Date(date);
  dateInfo['day'] = dateInfo.fullDate.getDate();
  dateInfo['month'] = dateInfo.fullDate.getMonth();
  dateInfo['year'] = dateInfo.fullDate.getFullYear();
  dateInfo['dayOfWeek'] = dateInfo.fullDate.getDay();

  return dateInfo;
}

export function getLastWeek(startingDate) {
  const lastWeekDates = {};
  let date = new Date(startingDate);
  lastWeekDates[0] = createDateObject(date);
  for (let i = 1; i < 7; i++) {
    let calcDate = new Date(date);
    calcDate.setDate(date.getDate() - i);
    calcDate = createDateObject(calcDate);
    lastWeekDates[-i] = calcDate;
  }
  return lastWeekDates;
}

export function storeTodayTotalTime(totalTime) {
  let today = new Date().toDateString();
  // set the total time for today in seconds whenever you open the popup
  chrome.storage.sync.get('totals', (res) => {
    if ('totals' in res) {
      let newData = res['totals'];
      newData[today] = totalTime;
      chrome.storage.sync.set({ totals: newData });
    } else {
      chrome.storage.sync.set({ totals: { [today]: totalTime } });
    }
  });
}

export async function getTop3() {
  let orderedSites = await getTopSites();
  let top3 = [];

  for (let i = orderedSites.length - 1; i > orderedSites.length - 4; i--) {
    top3.push(orderedSites[i]);
  }

  top3.forEach(async (value, index) => {
    const parent = document.querySelector('.top3');

    const newDiv = document.createElement('div');

    const content = document.createTextNode(
      `${index + 1}. ${top3[index][0]} - ${getTimeFormat(top3[index][1])}`
    );

    newDiv.appendChild(content);

    parent.insertAdjacentElement('beforeEnd', newDiv);
  });
}

export function displayTodayTotalTime(totalTime) {
  const totalTimeSpan = document.querySelector('.total-time');
  totalTime = getTimeFormat(totalTime);
  totalTimeSpan.innerHTML = totalTime;
}

export function toggleHide(element) {
  element.classList.toggle('hide');
}

export async function getTopSites() {
  let result = getAllData().then((res) => {
    let compiledResults = {};
    Object.keys(res)
      .filter((key) => {
        if (['activeState', 'budget', 'lastTab', 'totals'].includes(key)) {
          return false;
        }
        return true;
      })
      .map((date) => {
        for (const domain in res[date]) {
          if (domain in compiledResults) {
            let currentVal = compiledResults[domain];
            compiledResults[domain] = currentVal + res[date][domain];
          } else {
            compiledResults[domain] = res[date][domain];
          }
        }
      });

    let sortedTotals = Object.keys(compiledResults)
      .map((key) => {
        return [key, compiledResults[key]];
      })
      .sort((a, b) => a[1] - b[1]);
    return sortedTotals;
  });

  return result;
}

export async function getWeeklyAvg() {
  const avgContainer = document.querySelector('.weekly-avg');

  const totals = await chrome.storage.sync.get('totals');

  let weeklySum = Object.values(totals['totals']).reduce((a, b) => a + b, 0);

  let weeklyAvg = weeklySum / Object.keys(totals['totals']).length;

  weeklyAvg = getTimeFormat3(weeklyAvg);

  avgContainer.innerHTML = `Daily Average Web Time: ${weeklyAvg}`;
}

export async function getBudgets() {
  const budgetContainer = document.querySelector('.budget-container');
  const today = new Date().toDateString();
  const todaysData = await chrome.storage.sync.get(today);

  let budgets = await chrome.storage.sync.get('budget');
  budgets = budgets['budget'];
  let index = 1;

  for (let domain in budgets) {
    let newDiv = document.createElement('div');
    let usedTime = todaysData[today][domain];
    usedTime = getTimeFormat3(usedTime);
    let budgetedTime = budgets[domain];
    budgetedTime = getTimeFormat3(budgetedTime);
    newDiv.innerHTML = `<div class = budget${index}>
                            <h2>${domain}</h2>
                            <span> ${usedTime} / ${budgetedTime}</span>
                        </div>
    `;
    index++;
    budgetContainer.appendChild(newDiv);
  }
}
