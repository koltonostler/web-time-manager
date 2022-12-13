'use strict';

export function getHours(seconds) {
  const hours = Math.floor(seconds / 3600);
  return hours;
}

export function getMinute(seconds, hours) {
  const min = Math.floor((seconds - hours * 3600) / 60);
  return min;
}

export function zeroPad(num, places) {
  return String(num).padStart(places, '0');
}

export function getTimeFormat(totalSeconds) {
  const hours = getHours(totalSeconds);
  const min = getMinute(totalSeconds, hours);
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
  const hours = getHours(totalSeconds);
  const min = getMinute(totalSeconds, hours);
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
  const hours = getHours(totalSeconds);
  const min = getMinute(totalSeconds, hours);
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
  const response = await chrome.storage.local.get(null);
  return response;
}

// function that verifies the url is valid and returns the domain.
export function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    if (domain.startsWith('www.')) {
      return domain.substring(4);
    }
    return domain;
  } catch (err) {
    return 'invalid';
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

export async function getTotalTimes() {
  let today = new Date().toDateString();
  const lastWeek = getLastWeek(today);

  for (let day in lastWeek) {
    const date = lastWeek[day].fullDate.toDateString();
    let totalsData = await chrome.storage.local.get('totals');
    let data = await chrome.storage.local.get(date);
    if (Object.keys(data).length === 0) {
      console.log(`no data for ${date}`);
    } else {
      data = data[date];
      const dateSum = Object.values(data).reduce((a, b) => a + b, 0);
      if (Object.keys(totalsData).length === 0) {
        chrome.storage.local.set({ totals: { [date]: dateSum } });
      } else {
        let newData = totalsData['totals'];
        newData[date] = dateSum;
        chrome.storage.local.set({ totals: newData });
      }
    }
  }
}

export async function getTop3() {
  let orderedSites = await getTopSites();
  let top3 = [];

  for (let i = orderedSites.length - 1; i > orderedSites.length - 4; i--) {
    if (orderedSites[i] !== undefined) {
      top3.push(orderedSites[i]);
    }
  }

  top3.forEach(async (value, index) => {
    const parent = document.querySelector('.top3');
    const newDiv = document.createElement('div');
    newDiv.classList.add('top3-info');

    const titleDiv = document.createElement('div');
    const timeDiv = document.createElement('div');

    const titleContent = document.createTextNode(
      `${index + 1}. ${top3[index][0]}`
    );
    const timeContent = document.createTextNode(
      `${getTimeFormat(top3[index][1])}`
    );

    titleDiv.appendChild(titleContent);
    timeDiv.appendChild(timeContent);
    timeDiv.style.fontWeight = '700';

    newDiv.insertAdjacentElement('beforeEnd', titleDiv);
    newDiv.insertAdjacentElement('beforeEnd', timeDiv);

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
  const totals = await chrome.storage.local.get('totals');
  if (Object.keys(totals).length === 0) {
    chrome.storage.local.set({ totals: {} });
  } else {
    let weeklySum = Object.values(totals['totals']).reduce((a, b) => a + b, 0);
    let weeklyAvg = weeklySum / Object.keys(totals['totals']).length;
    weeklyAvg = getTimeFormat3(weeklyAvg);
    avgContainer.innerHTML = `${weeklyAvg}`;
  }
}

function addCancelListner(btn, popup) {
  btn.addEventListener('click', () => {
    closePopup(popup);
  });
}

function closePopup(popup) {
  popup.style.top = '50px';
  popup.style.opacity = '0';
  popup.style.zIndex = '-2';
}

function openPopup(popup) {
  if (popup === document.querySelector('.budget-popup-1')) {
    let urlInput = document.querySelector('#url');
    urlInput.focus();
  }
  popup.style.top = '100px';
  popup.style.opacity = '1';
  popup.style.zIndex = '2';
}

function addOpenPopupListner(btn, popup, popupToClose) {
  btn.addEventListener('click', () => {
    openPopup(popup);
    closePopup(popupToClose);
    const domain = btn.id;
    populateBudgetedTime(domain);
  });
}

export async function getBudgets() {
  let budgetContainer = document.querySelector('.budget-container');
  let today = new Date().toDateString();
  let todaysData = await chrome.storage.local.get(today);

  let budgets = await chrome.storage.local.get('budget');
  budgets = budgets['budget'];
  let index = 0;
  for (let domain in budgets) {
    let newDiv = document.createElement('div');
    let usedTime = todaysData[today][domain];
    if (isNaN(usedTime)) {
      usedTime = '0m';
    } else {
      usedTime = getTimeFormat3(usedTime);
    }
    let budgetedTime = budgets[domain];
    budgetedTime = getTimeFormat3(budgetedTime);
    newDiv.innerHTML = `<div class ='budget'>
                            <div class ='budget-name'>${domain}</div>
                            <div class = "bar-container">
                                <span class='budget-time'> <b>${usedTime}</b> / ${budgetedTime}</span>
                                <div class = "budget-bar" id="bar-${index}"></div>
                            </div>
                            <button class="material-symbols-outlined timer" id="${domain}" title="edit timer">timer</button>                                           
                        </div>
    `;
    budgetContainer.appendChild(newDiv);
    createBarCss(index, todaysData[today][domain], budgets[domain]);
    index++;
  }
  setupBudgetListeners();
}

function createBarCss(index, usedTime, totalTime) {
  const colorOptions = [
    'rgb(54, 162, 235)',
    'rgb(153, 102, 255)',
    'rgb(255, 205, 86)',
    'rgb(255, 99, 132)',
    'rgb(201, 203, 207)',
    'rgb(255, 159, 64)',
    'rgb(75, 192, 192)',
  ];
  // get bar I want to change
  const budgetBar = document.querySelector(`#bar-${index}`);
  // if budget is hit make background color red;
  if (usedTime >= totalTime) {
    budgetBar.style.backgroundColor = '#ff2222';
  } else {
    // get fraction of usedTime of totalTime
    let budgetFraction = usedTime / totalTime;
    let percentage = budgetFraction * 100 + '%';
    let transparentPercentage = (budgetFraction + 0.01) * 100 + '%';
    // set a gradient with the correct percentages
    budgetBar.style.backgroundImage = `linear-gradient(to right, ${
      colorOptions[index % 6]
    } ${percentage}, transparent ${transparentPercentage})`;
  }
}

export function setCounterEvents() {
  const countBtns = document.querySelectorAll('.time-input button');
  const countTargets = document.querySelectorAll('.time-input div');
  let slowIndex = 0;
  countBtns.forEach((btn, index) => {
    let target = countTargets[slowIndex];
    addIncDecListner(btn, target);
    if (index % 2 === 1) {
      slowIndex++;
    }
  });
}

export function setupBudgetListeners() {
  const editBtns = document.querySelectorAll('.timer');
  const popup1 = document.querySelector('.budget-popup-1');
  const popup2 = document.querySelector('.budget-popup-2');
  const cancelBtn1 = document.querySelector('#cancel-1');
  const cancelBtn2 = document.querySelector('#cancel-2');
  const addBtn = document.querySelector('.add');

  editBtns.forEach((btn) => {
    addOpenPopupListner(btn, popup2, popup1);
  });
  addOpenPopupListner(addBtn, popup1, popup2);
  addCancelListner(cancelBtn2, popup2);
  addCancelListner(cancelBtn1, popup1);
}

export function addIncDecListner(btn, target) {
  if (btn.classList.contains('more')) {
    btn.addEventListener('click', () => {
      let count = parseInt(target.innerText);
      count++;
      if (target.classList.contains('minute-display')) {
        if (count > 59) {
          count = 0;
        }
      }
      if (target.classList.contains('hour-display')) {
        if (count > 24) {
          count = 0;
        }
      }
      count = zeroPad(count, 2);
      target.textContent = count;
    });
  } else if (btn.classList.contains('less')) {
    btn.addEventListener('click', () => {
      let count = parseInt(target.innerText);
      count--;
      if (target.classList.contains('minute-display')) {
        if (count < 0) {
          count = 59;
        }
      }
      if (target.classList.contains('hour-display')) {
        if (count < 0) {
          count = 24;
        }
      }
      count = zeroPad(count, 2);
      target.textContent = count;
    });
  }
}

async function populateBudgetedTime(domain) {
  let budgets = await chrome.storage.local.get('budget');
  budgets = budgets['budget'];
  const header = document.querySelector('.budget-popup-2 > .popup-header');
  const hourDiv = document.querySelector('#hour-2');
  const minDiv = document.querySelector('#min-2');
  header.innerText = `Set timer for ${domain}`;

  let hour = getHours(budgets[domain]);
  let min = getMinute(budgets[domain], hour);
  if (isNaN(hour)) {
    hour = 0;
  }
  if (isNaN(min)) {
    min = 0;
  }

  hour = zeroPad(hour, 2);
  min = zeroPad(min, 2);

  hourDiv.innerText = hour;
  minDiv.innerText = min;
}

export function updateBudget() {
  const popup = document.querySelector('.budget-popup-2');
  let hourDiv = document.querySelector('#hour-2');
  let minDiv = document.querySelector('#min-2');
  const header = document.querySelector('.budget-popup-2 > .popup-header');
  const budgetContainer = document.querySelector('.budget-container');
  const headerText = header.innerText;

  let hour = parseInt(hourDiv.innerText);
  let min = parseInt(minDiv.innerText);
  let timer = hour * 3600 + min * 60;
  let domain = headerText.split(' ').pop();

  if (timer === 0) {
    alert("timer can't be 0");
  } else {
    setBudget(domain, timer);
    closePopup(popup);
    budgetContainer.innerHTML = '';
    getBudgets();
  }
}

export function saveNewBudget() {
  const popup = document.querySelector('.budget-popup-1');
  const budgetContainer = document.querySelector('.budget-container');
  const urlInput = document.querySelector('#url');
  let hourDiv = document.querySelector('#hour-1');
  let minDiv = document.querySelector('#min-1');

  let hour = parseInt(hourDiv.innerText);
  let min = parseInt(minDiv.innerText);

  let timer = hour * 3600 + min * 60;
  let url = urlInput.value;

  if (url.indexOf(' ') === -1) {
    if (url.length === 0) {
      alert('url cannot be empty');
    } else if (timer === 0) {
      alert("timer can't be 0");
    } else {
      setBudget(url, timer);
      closePopup(popup);
      urlInput.value = '';
      hourDiv.innerText = '00';
      minDiv.innerText = '00';
      budgetContainer.innerHTML = '';
      getBudgets();
    }
  } else {
    alert('please input a correct url');
  }
}

export async function deleteBudget() {
  console.log('deleted');
  const popup = document.querySelector('.budget-popup-2');
  const header = document.querySelector('.budget-popup-2 > .popup-header');
  const budgetContainer = document.querySelector('.budget-container');
  const headerText = header.innerText;
  let domain = headerText.split(' ').pop();
  let budgetData = await chrome.storage.local.get('budget');
  budgetData = budgetData['budget'];
  delete budgetData[domain];
  console.log(budgetData);
  chrome.storage.local.set({ budget: budgetData });
  closePopup(popup);
  budgetContainer.innerHTML = '';
  getBudgets();
}

// function that will set the budget with inputs from set-timer form
function setBudget(url, timer) {
  // convert input to valid url
  url = `https://${url}`;
  let domain = getDomain(url);
  if (domain !== 'invalid') {
    chrome.storage.local.get('budget', (res) => {
      // if domain does not already have data, just set the budget
      if (Object.keys(res).length === 0) {
        chrome.storage.local.set({ budget: { [domain]: timer } });
      } else {
        // if the domain already has data, we need to add the 'budget' key with the new budget as the value
        let newData = res['budget'];
        newData[domain] = timer;
        chrome.storage.local.set({ budget: newData });
      }
    });
  }
}
