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
  chrome.storage.sync.set({ [today]: totalTime });
}

export function displayTodayTotalTime(totalTime) {
  const totalTimeSpan = document.querySelector('#total-time');
  totalTime = getTimeFormat(totalTime);
  totalTimeSpan.innerHTML = totalTime;
}
