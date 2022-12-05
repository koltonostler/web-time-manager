'use strict';

import './popup.css';
import { createTodaysChart, createWeeklyChart } from './chart';
import {
  deleteBudget,
  displayTodayTotalTime,
  getBudgets,
  getDomain,
  getTimeFormat,
  getTop3,
  getTopSites,
  getWeeklyAvg,
  saveNewBudget,
  setCounterEvents,
  setupBudgetListeners,
  storeTodayTotalTime,
  toggleHide,
  updateBudget,
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
setupBudgetListeners();
setCounterEvents();
storeTodayTotalTime(totalTime);
displayTodayTotalTime(totalTime);
getTop3();

let toggleActive = { trackActive: true };

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
const deleteBtn = document.querySelector('#delete');
const newSaveBtn = document.querySelector('#save-1');
const updateBudgetBtn = document.querySelector('#save-2');

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

deleteBtn.addEventListener('click', deleteBudget);
newSaveBtn.addEventListener('click', saveNewBudget);
updateBudgetBtn.addEventListener('click', updateBudget);
