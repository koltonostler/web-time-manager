'use strict';

import './popup.css';
import { createTodaysChart, createWeeklyChart } from './chart';
import {
  displayTodayTotalTime,
  getBudgets,
  getDomain,
  getTimeFormat,
  getTop3,
  getTopSites,
  getWeeklyAvg,
  storeTodayTotalTime,
  toggleHide,
} from './calculations';

let todaysChart;
let weeklyChart;
let displayedChart = 'daily';

// create today's doughnut chart
todaysChart = await createTodaysChart();

let totalTime = todaysChart.config.data.datasets[0].data.reduce(
  (a, b) => a + b,
  0
);

getWeeklyAvg();
getBudgets();
storeTodayTotalTime(totalTime);
displayTodayTotalTime(totalTime);
getTop3();

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

const dailyBtn = document.querySelector('#daily');
const weeklyBtn = document.querySelector('#weekly');
const timeSpan = document.querySelector('.total-time');
const top3Div = document.querySelector('.top3');
const weeklyAvg = document.querySelector('.weekly-avg');

dailyBtn.addEventListener('click', async () => {
  if (displayedChart === 'weekly') {
    weeklyChart.destroy();
    todaysChart = await createTodaysChart();
    toggleHide(timeSpan);
    toggleHide(top3Div);
    toggleHide(weeklyAvg);
    displayedChart = 'daily';
  }
});
weeklyBtn.addEventListener('click', async () => {
  if (displayedChart === 'daily') {
    todaysChart.destroy();
    weeklyChart = await createWeeklyChart();
    toggleHide(timeSpan);
    toggleHide(top3Div);
    toggleHide(weeklyAvg);
    displayedChart = 'weekly';
  }
});
