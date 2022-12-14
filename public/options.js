'use strict';

let options = {};

const allTabsCheckbox = document.getElementById('all-tabs-checkbox');
const mediaCheckbox = document.getElementById('idle-media-checkbox');
const dropDown = document.getElementById('idle-timer');

chrome.runtime.sendMessage({ msg: 'getIgnoreList' }, async function (response) {
  let ignoreList = await response.ignoreList;
  updateIgnoreList(ignoreList);
});

chrome.runtime.sendMessage({ msg: 'getOptions' }, async function (response) {
  options = await response.options;
  console.log(options);
  if (options.idleMediaCheck) {
    mediaCheckbox.checked = true;
  } else {
    mediaCheckbox.checked = false;
  }

  if (options.trackAllTabs) {
    allTabsCheckbox.checked = true;
  } else {
    allTabsCheckbox.checked = false;
  }

  dropDown.value = options.idleTimer;
});

function updateOptions() {
  chrome.storage.local.set({ options: options });
}

allTabsCheckbox.addEventListener('change', () => {
  options.trackAllTabs = !options.trackAllTabs;
  updateOptions();
  chrome.runtime.sendMessage({ options: options });
});

mediaCheckbox.addEventListener('change', () => {
  options.idleMediaCheck = !options.idleMediaCheck;
  updateOptions();
  chrome.runtime.sendMessage({ options: options });
});

dropDown.addEventListener('change', () => {
  options.idleTimer = parseInt(dropDown.value);
  updateOptions();
  chrome.runtime.sendMessage({ options: options });
});

function populateIgnoreList(url, index) {
  url = `https://${url}`;
  let domain = getDomain(url);
  const ignoreContainer = document.querySelector('.ignored-list');

  let li = document.createElement('li');
  let urlSpan = document.createElement('span');
  let closeSpan = document.createElement('span');

  const urlContent = document.createTextNode(`${domain}`);
  const closeContent = document.createTextNode('close');

  urlSpan.appendChild(urlContent);
  closeSpan.appendChild(closeContent);
  closeSpan.classList.add('material-symbols-outlined');
  closeSpan.classList.add('remove');
  closeSpan.addEventListener('click', async () => {
    await removeIgnoreUrl(domain, index);
  });

  li.insertAdjacentElement('beforeEnd', urlSpan);
  li.insertAdjacentElement('beforeEnd', closeSpan);
  li.id = `ignore-${index}`;

  ignoreContainer.insertAdjacentElement('beforeEnd', li);
}

async function removeIgnoreUrl(url, index) {
  const liToRemove = document.getElementById(`ignore-${index}`);
  let currentIgnoreList = await chrome.storage.local.get('ignoreList');

  currentIgnoreList = currentIgnoreList.ignoreList;

  let newIgnoreList = currentIgnoreList.filter((item) => item !== url);
  chrome.runtime.sendMessage({ ignoreList: newIgnoreList });

  chrome.storage.local.set({ ignoreList: newIgnoreList });
  liToRemove.remove();
}

const addIgnoreBtn = document.querySelector('.add');
const cancelBtn = document.querySelector('.cancel');
const saveBtn = document.querySelector('.save');
const popup = document.querySelector('.ignore-popup');

saveBtn.addEventListener('click', async () => {
  saveIgnoreUrl();
});

cancelBtn.addEventListener('click', () => {
  closePopup(popup);
});

addIgnoreBtn.addEventListener('click', () => {
  openPopup(popup);
});

async function saveIgnoreUrl() {
  const urlInput = document.querySelector('#url');
  const popup = document.querySelector('.ignore-popup');
  const ignoreContainer = document.querySelector('.ignored-list');
  let ignoreListCount = ignoreContainer.children.length;
  let ignoreListUrls = await chrome.storage.local.get('ignoreList');
  ignoreListUrls = ignoreListUrls.ignoreList;

  let url = urlInput.value;

  if (url.indexOf(' ') === -1) {
    if (url.length === 0) {
      alert('url cannot be empty');
    } else if (ignoreListUrls.includes(getDomain(`https://${url}`))) {
      alert('url already in ignore list');
    } else {
      saveUrlToLocalStorage(url);
      populateIgnoreList(url, ignoreListCount);
      closePopup(popup);
      urlInput.value = '';
    }
  } else {
    alert('please input a correct url');
  }
}

function saveUrlToLocalStorage(url) {
  url = `https://${url}`;
  let domain = getDomain(url);
  if (domain !== 'invalid') {
    chrome.storage.local.get('ignoreList', (res) => {
      if (Object.keys(res).length === 0) {
        chrome.storage.local.set({ ignoreList: [domain] });
        chrome.runtime.sendMessage({ ignoreList: [domain] });
      } else {
        let newList = res.ignoreList;
        newList.push(domain);
        chrome.runtime.sendMessage({ ignoreList: newList });
        chrome.storage.local.set({ ignoreList: newList });
      }
    });
  }
}

async function updateIgnoreList(ignoreList) {
  if (ignoreList.length === 0) {
    return;
  }
  for (let url in ignoreList) {
    populateIgnoreList(ignoreList[url], url);
  }
}

function openPopup(popup) {
  let urlInput = document.querySelector('#url');
  urlInput.focus();
  popup.style.top = '100px';
  popup.style.opacity = '1';
  popup.style.zIndex = '2';
}

function closePopup(popup) {
  popup.style.top = '50px';
  popup.style.opacity = '0';
  popup.style.zIndex = '-2';
}

function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    if (domain.startsWith('www.')) {
      return domain.substring(4);
    }
    return domain;
  } catch (err) {
    return 'invalid';
  }
}
