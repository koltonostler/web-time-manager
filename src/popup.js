'use strict';

import './popup.css';
import { createTodaysChart, createWeeklyChart } from './chart';
import {
  deleteBudget,
  displayTodayTotalTime,
  getBudgets,
  getTop3,
  getTotalTimes,
  getWeeklyAvg,
  saveNewBudget,
  setCounterEvents,
  setupBudgetListeners,
  toggleHide,
  updateBudget,
} from './calculations';

let todaysChart;
let weeklyChart;
let displayedChart = 'daily';

// create today's doughnut chart
todaysChart = await createTodaysChart();

if (todaysChart !== null) {
  let totalTime = todaysChart.config.data.datasets[0].data.reduce(
    (a, b) => a + b,
    0
  );

  displayTodayTotalTime(totalTime);
}

await getTotalTimes();
await getWeeklyAvg();
getBudgets();
setupBudgetListeners();
setCounterEvents();
getTop3();

let toggleActive = { trackActive: true };

function saveActiveState() {
  chrome.storage.local.set({ activeState: toggleActive.trackActive });
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
const top3Div = document.querySelector('.top3-container');
const weeklyAvg = document.querySelector('.weekly-stats');
const deleteBtn = document.querySelector('#delete');
const newSaveBtn = document.querySelector('#save-1');
const updateBudgetBtn = document.querySelector('#save-2');
const dailyChartBtn = document.querySelector('#daily');
const weeklyChartBtn = document.querySelector('#weekly');
const settingsBtn = document.querySelector('.settings-icon');

let optionsUrl = chrome.runtime.getURL('options.html');

settingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: optionsUrl }, function (tab) {
    console.log('options tab opened');
  });
});

dailyChartBtn.addEventListener('click', () => {
  dailyChartBtn.classList.add('active-chart');
  weeklyChartBtn.classList.remove('active-chart');
});
weeklyChartBtn.addEventListener('click', () => {
  weeklyChartBtn.classList.add('active-chart');
  dailyChartBtn.classList.remove('active-chart');
});

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
