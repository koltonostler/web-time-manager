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

// function that verifies the url is valid and returns the domain.
export function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    return domain;
  } catch (err) {
    return 'hello';
  }
}
