'use strict';

import './popup.css';
import { createTodaysChart, createWeeklyChart } from './chart';
import {
  displayTodayTotalTime,
  getDomain,
  getTimeFormat,
  getTopSites,
  storeTodayTotalTime,
} from './calculations';

// create today's doughnut chart
let todaysChart = await createTodaysChart();

let totalTime = todaysChart.config.data.datasets[0].data.reduce(
  (a, b) => a + b,
  0
);

storeTodayTotalTime(totalTime);
displayTodayTotalTime(totalTime);

let weeklyChart = await createWeeklyChart();
const clearButton = document.getElementById('clearBtn');

clearButton.addEventListener('click', () => {
  chrome.storage.sync.clear();
});

let orderedSites = await getTopSites();

let top3 = [];

for (let i = orderedSites.length - 1; i > orderedSites.length - 4; i--) {
  top3.push(orderedSites[i]);
}

top3.forEach(async (value, index) => {
  const parent = document.getElementById('top3');

  const newDiv = document.createElement('div');

  const content = document.createTextNode(
    `${index + 1}. ${top3[index][0]} - ${getTimeFormat(top3[index][1])}`
  );

  newDiv.appendChild(content);

  parent.insertAdjacentElement('beforeEnd', newDiv);
});

let toggleActive = { trackActive: true };

const form = document.getElementById('timer-form');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  let url = form.elements['url'].value;
  let timer = form.elements['timer'].value;

  setBudget(url, timer);
  form.reset();
});

// function that will set the budget with inputs from set-timer form
function setBudget(url, timer) {
  // convert timer from minutes to seconds
  timer = timer * 60;
  // convert input to valid url
  url = `https://${url}`;
  let domain = getDomain(url);
  chrome.storage.sync.get('budget', (res) => {
    // if domain does not already have data, just set the budget
    if (Object.keys(res).length === 0) {
      chrome.storage.sync.set({ budget: { [domain]: timer } });
    } else {
      // if the domain already has data, we need to add the 'budget' key with the new budget as the value
      let newData = res['budget'];
      newData[domain] = timer;
      chrome.storage.sync.set({ budget: newData });
    }
  });
}

function saveActiveState() {
  chrome.storage.sync.set({ ['activeState']: toggleActive.trackActive });
}

const toggle = document.getElementById('checkbox');

toggle.addEventListener('change', () => {
  toggleActive.trackActive = !toggleActive.trackActive;
  saveActiveState();
  chrome.runtime.sendMessage(toggleActive);
});

chrome.runtime.sendMessage({ msg: 'getActiveState' }, function (response) {
  toggleActive.trackActive = response.activeState;
  toggle.checked = toggleActive.trackActive;
});
