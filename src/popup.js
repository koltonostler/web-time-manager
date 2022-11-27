'use strict';

import Chart from 'chart.js/auto';
import './popup.css';

const selection = document.querySelector('#chart-selection');
let chartSelection = 'top5';

async function getTodaysData() {
  const response = await chrome.storage.sync.get(null);
  return response;
}

getTodaysData().then((data) => {
  let today = new Date().toDateString();
  console.log(data);
  const sortedData = Object.keys(data)
    .filter((key) => {
      if (key === 'activeState') {
        return false;
      }
      return true;
    })
    .map((key) => {
      return [key, data[key][today]];
    })
    .sort((a, b) => a[1] - b[1]);

  let todaysData = sortedData.map((datapoint) => {
    return datapoint[1];
  });
  let todaysLabels = sortedData.map((datapoint) => {
    return datapoint[0];
  });

  const total = todaysData.reduce((a, b) => a + b, 0);

  const chartData = {
    labels: todaysLabels,
    datasets: [
      {
        data: todaysData,
        hoverOffset: 40,
      },
    ],
  };

  let options = {
    plugins: {
      legend: {
        display: true,
        reverse: true,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const totalSeconds = context.parsed;
            const hours = Math.floor(totalSeconds / 3600);
            const min = Math.floor((totalSeconds - hours * 3600) / 60);
            let sec = totalSeconds - hours * 3600 - min * 60;
            sec = Math.round(sec * 100) / 100;
            sec = sec.toFixed(0);
            let timeFormat = ` ${hours} hr ${min} min`;
            if (hours < 1) {
              if (min < 1) {
                timeFormat = ` ${sec} sec`;
              } else {
                timeFormat = ` ${min} min ${sec} sec`;
              }
            }
            return timeFormat;
          },
          afterLabel: function (context) {
            const percentage = context.parsed / total;
            return '(' + (percentage * 100).toFixed(2) + '%)';
          },
        },
      },
    },
  };

  let chart = new Chart(document.getElementById('acquisitions'), {
    type: 'doughnut',
    data: chartData,
    options: options,
  });

  selection.addEventListener('change', (e) => {
    console.log('changed');
    chartSelection = e.target.value;
    if (chartSelection === 'top5') {
      const top5 = sortedData.slice(sortedData.length - 5, sortedData.length);
      todaysData = top5.map((datapoint) => {
        return datapoint[1];
      });
      todaysLabels = top5.map((datapoint) => {
        return datapoint[0];
      });
    } else {
      todaysData = sortedData.map((datapoint) => {
        return datapoint[1];
      });
      todaysLabels = sortedData.map((datapoint) => {
        return datapoint[0];
      });
    }
    (chartData.datasets = [
      {
        data: todaysData,
        hoverOffset: 40,
      },
    ]),
      (chartData.labels = todaysLabels);
    chart.update();
  });
});

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
