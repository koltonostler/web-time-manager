'use strict';

import Chart from 'chart.js/auto';
import './popup.css';
import { createTodaysChart } from './chart';
import { getTimeFormat } from './calculations';

let todaysChart = await createTodaysChart();

const totalTimeSpan = document.querySelector('#total-time');

let totalTime = todaysChart.config.data.datasets[0].data.reduce(
  (a, b) => a + b,
  0
);

totalTime = getTimeFormat(totalTime);

totalTimeSpan.innerHTML = totalTime;

const clearButton = document.getElementById('clearBtn');

clearButton.addEventListener('click', () => {
  chrome.storage.sync.clear();
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
  let domain = new URL(url).hostname;
  chrome.storage.sync.get(domain, (res) => {
    // if domain does not already have data, just set the budget
    if (Object.keys(res).length === 0) {
      chrome.storage.sync.set({ [domain]: { budget: timer } });
    } else {
      // if the domain already has data, we need to add the 'budget' key with the new budget as the value
      let newData = res[domain];
      newData['budget'] = timer;
      chrome.storage.sync.set({ [domain]: newData });
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
  console.log(`message from background: ${JSON.stringify(response)}`);
  toggleActive.trackActive = response.activeState;
  toggle.checked = toggleActive.trackActive;
});
