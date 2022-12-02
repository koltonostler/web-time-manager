'use strict';
import Chart from 'chart.js/auto';
import {
  getAllData,
  getLastWeek,
  getTimeFormat,
  getTimeFormat2,
} from './calculations';

export async function createTodaysChart() {
  let chart = await getAllData().then((data) => {
    const today = new Date().toDateString();

    const sortedData = Object.keys(data[today])
      .map((domain) => {
        return [domain, data[today][domain]];
      })
      .sort((a, b) => a[1] - b[1]);

    let todaysData = sortedData.map((datapoint) => {
      return datapoint[1];
    });
    let todaysLabels = sortedData.map((datapoint) => {
      return datapoint[0];
    });

    let otherLabels;
    let otherData;

    if (sortedData.length > 5) {
      let top5 = sortedData.splice(sortedData.length - 5, sortedData.length);
      todaysLabels = top5.map((datapoint) => {
        return datapoint[0];
      });
      top5 = top5.map((datapoint) => {
        return datapoint[1];
      });

      let otherSortedData = sortedData.splice(0, sortedData.length);

      otherLabels = otherSortedData.map((datapoint) => {
        return datapoint[0];
      });

      otherData = otherSortedData.map((datapoint) => {
        return datapoint[1];
      });

      let other = otherData.reduce((a, b) => a + b, 0);

      todaysData = top5;
      todaysData.unshift(other);
      todaysLabels.unshift('other');
    }

    const total = todaysData.reduce((a, b) => a + b, 0);

    const chartData = {
      labels: todaysLabels,
      datasets: [
        {
          data: todaysData,
          hoverOffset: 20,
          labels: todaysLabels,
        },
      ],
    };

    const chartActions = {
      name: 'Show Other',
      handler(chart) {
        const newDataset = {
          data: otherData,
          hoverOffset: -10,
          labels: otherLabels,
          backgroundColor: [
            'rgb(255, 99, 132)',
            'rgb(255, 159, 64)',
            'rgb(255, 205, 86)',
            'rgb(75, 192, 192)',
            'rgb(54, 162, 235)',
            'rgb(153, 102, 255)',
            'rgb(201, 203, 207)',
          ],
        };

        chart.data.datasets.push(newDataset);
        chart.update();
      },
    };

    const options = {
      plugins: {
        legend: {
          display: true,
          reverse: true,
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              let index = context[0].dataIndex;
              if (context[0].dataset.labels[index] === 'other') {
                return 'other (click for details)';
              }
              return context[0].dataset.labels[index];
            },
            label: function (context) {
              const totalSeconds = context.parsed;
              return getTimeFormat(totalSeconds);
            },
            afterLabel: function (context) {
              let percentage = context.parsed / total;
              return '(' + (percentage * 100).toFixed(2) + '%)';
            },
          },
        },
      },
    };
    const config = {
      type: 'doughnut',
      data: chartData,
      options: options,
    };

    const ctx = document.getElementById('chart');
    let myChart = new Chart(ctx, config);

    function getSlice(click) {
      const slice = myChart.getElementsAtEventForMode(
        click,
        'nearest',
        { intersect: true },
        true
      );
      if (slice.length) {
        const firstSlice = slice[0];
        const label =
          myChart.data.datasets[firstSlice.datasetIndex].labels[
            firstSlice.index
          ];
        if (label === 'other' && myChart.data.datasets.length < 2) {
          chartActions.handler(myChart);
        } else if (myChart.data.datasets.length > 1) {
          myChart.data.datasets.pop();
          chart.update();
        }
      }
    }

    ctx.onclick = getSlice;

    return myChart;
  });
  return chart;
}

export async function createWeeklyChart() {
  let weeklyChart = getAllData().then((res) => {
    let weeklyLabels = [];

    let weeklyData = [];
    const today = new Date().toDateString();
    const lastWeek = getLastWeek(today);
    for (let date in lastWeek) {
      let dateString = lastWeek[date].fullDate.toDateString();
      let dayMonth = lastWeek[date].fullDate.toLocaleDateString('en-us', {
        month: 'short',
        day: 'numeric',
      });
      let value = res['totals'][dateString];
      weeklyLabels.unshift(dayMonth);
      weeklyData.unshift(value);
    }

    function calcStepSize(weeklyData) {
      // default step size is 30min(1800 sec);
      let stepSize = 1800;

      // get the max of the weeklyData
      let max = weeklyData.reduce((prev, curr) => {
        return prev > curr ? prev : curr;
      });

      // if the max is greater than 3hr(10800 sec), up the step size to 1hr(3600 sec)
      if (max >= 10800) {
        stepSize = 3600;
      }

      return stepSize;
    }

    const chartData = {
      labels: weeklyLabels,
      datasets: [
        {
          label: 'Weekly Dashboard',
          data: weeklyData,
          backgroundColor: [
            'rgb(255, 159, 64)',
            'rgb(255, 205, 86)',
            'rgb(255, 99, 132)',
            'rgb(75, 192, 192)',
            'rgb(54, 162, 235)',
            'rgb(201, 203, 207)',
            'rgb(153, 102, 255)',
          ],
        },
      ],
    };

    const options = {
      scales: {
        y: {
          beginAtZero: true,
          grid: { display: true },
          ticks: {
            font: {
              size: 11,
            },
            stepSize: calcStepSize(weeklyData),
            callback: function (value, index, ticks) {
              let formatedValue = getTimeFormat2(value);
              return formatedValue;
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const totalSeconds = context.raw;
              return getTimeFormat(totalSeconds);
            },
          },
        },
      },
    };

    const config = {
      type: 'bar',
      data: chartData,
      options: options,
    };

    const ctx = document.getElementById('chart');
    let chart = new Chart(ctx, config);

    return chart;
  });
  return weeklyChart;
}
