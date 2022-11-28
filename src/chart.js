'use strict';
import Chart from 'chart.js/auto';
import { getTimeFormat } from './calculations';

export async function createTodaysChart() {
  async function getTodaysData() {
    const response = await chrome.storage.sync.get(null);
    return response;
  }

  let chart = await getTodaysData().then((data) => {
    const today = new Date().toDateString();

    const sortedData = Object.keys(data)
      .filter((key) => {
        if (key === 'activeState' || data[key][today] === undefined) {
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
          hoverOffset: 40,
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
              console.log(context[0].dataIndex);
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

    const ctx = document.getElementById('acquisitions');
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

        console.log(firstSlice);
        console.log(myChart);
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