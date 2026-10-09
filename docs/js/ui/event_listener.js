/**
 * Event Listener: Handles UI events, action dispatches (view/download/iso), and file import
 */

// Action dispatcher for View / Download / ISO
function handleEngineAction(action, formElem, buttonElem) {
  var config = getConfig();

  if (config.mode === 'server' && config.serverEndpoint) {
    var actionUrl = config.serverEndpoint.replace(/\/+$/, '') + '/' + action + '/';
    formElem.action = actionUrl;
    formElem.method = 'POST';
    formElem.target = (action === 'view') ? '_blank' : '_self';
    formElem.submit();
    return true;
  }

  var formData = new FormData(formElem);
  var xmlContent = generateAutounattendXml(formData);

  if (action === 'view') {
    var blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return true;
  } else if (action === 'download') {
    var blobXml = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    var dlUrl = URL.createObjectURL(blobXml);
    var a = document.createElement('a');
    a.href = dlUrl;
    a.download = 'autounattend.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(dlUrl); }, 10000);
    return true;
  } else if (action === 'iso') {
    var isoBlob = createIsoBlob('autounattend.xml', xmlContent);
    var isoUrl = URL.createObjectURL(isoBlob);
    var aIso = document.createElement('a');
    aIso.href = isoUrl;
    aIso.download = 'autounattend.iso';
    document.body.appendChild(aIso);
    aIso.click();
    document.body.removeChild(aIso);
    setTimeout(function () { URL.revokeObjectURL(isoUrl); }, 10000);
    return true;
  }

  return false;
}

// File import dispatcher using FileReader
function importXmlFile(file, callback, targetForm) {
  if (!file) {
    if (callback) callback(new Error('ファイルが指定されていません。'));
    return;
  }
  if (typeof FileReader === 'undefined') {
    var err = new Error('FileReader API に対応していません。');
    if (callback) callback(err);
    return;
  }

  var form = targetForm || getMainForm();
  var reader = new FileReader();
  reader.onload = function (evt) {
    try {
      var text = evt.target.result;
      var query = extractQueryFromXml(text);
      var ok = false;

      var xmlDoc = null;
      if (typeof DOMParser !== 'undefined') {
        try {
          var parser = new DOMParser();
          xmlDoc = parser.parseFromString(text, 'application/xml');
          if (xmlDoc.querySelector('parsererror')) {
            xmlDoc = null;
          }
        } catch (pe) {
          xmlDoc = null;
        }
      }

      if (query) {
        ok = applyQueryToForm(query, form);
        var params = null;
        try {
          params = new URLSearchParams(query.indexOf('?') === 0 ? query.substring(1) : query);
        } catch (e) {
          params = null;
        }

        if (xmlDoc) {
          overrideFormFromXmlDom(xmlDoc, form, params);
        }

        var finalQuery = params ? params.toString() : query;
        if (ok) {
          // 1. セッションストレージに設定状態をキャッシュ保存
          if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
              window.sessionStorage.setItem('unattend_generator_session_state', finalQuery);
            } catch (se) {
              console.warn('sessionStorage 保存に失敗しました:', se);
            }
          }
          // 2. URLクエリ長制御: 2000文字以内の場合のみURLに反映、超過時はクエリを除去してリロード時のHTTP 414エラーを防止
          if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
            if (finalQuery.length <= 2000) {
              window.history.replaceState(null, '', '?' + finalQuery);
            } else {
              var cleanUrl = (window.location && window.location.pathname) ? window.location.pathname : './';
              window.history.replaceState(null, '', cleanUrl);
            }
          }
        }
      } else {
        if (!xmlDoc) {
          var parseErr = new Error('XMLファイルの解析に失敗しました。書式が無効です。');
          if (callback) callback(parseErr);
          else alert(parseErr.message);
          return;
        }
        ok = applyXmlDomToForm(xmlDoc, form);
      }

      if (ok) {
        if (callback) {
          callback(null, true);
        } else {
          alert('XMLファイルの設定を正常にインポートしました。');
        }
      } else {
        var failErr = new Error('XML設定の反映に失敗しました。');
        if (callback) callback(failErr);
        else alert(failErr.message);
      }
    } catch (e) {
      console.error('importXmlFile error:', e);
      if (callback) callback(e);
      else alert('インポート処理中にエラーが発生しました: ' + e.message);
    }
  };
  reader.onerror = function (e) {
    if (callback) callback(e);
    else alert('ファイルの読み込みに失敗しました。');
  };
  reader.readAsText(file);
}


// Restore form state from window.location.search or sessionStorage fallback
function restoreFromUrlQuery(targetForm) {
  if (typeof window === 'undefined') {
    return false;
  }
  var form = targetForm || getMainForm();
  var search = (window.location && window.location.search) ? window.location.search : '';
  if (search.length > 1) {
    return applyQueryToForm(search, form);
  }
  // URLクエリがない場合、sessionStorageのキャッシュから自動復元
  if (window.sessionStorage) {
    try {
      var cached = window.sessionStorage.getItem('unattend_generator_session_state');
      if (cached && cached.length > 0) {
        return applyQueryToForm(cached, form);
      }
    } catch (e) {
      console.warn('sessionStorage からの復元に失敗しました:', e);
    }
  }
  return false;
}

// Setup form submission interceptor
function initEngine() {
  if (typeof document === 'undefined') return;

  // 1. Intercept buttons (View, ISO, Download, and Import)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button, input[type="submit"]');
    if (!btn) return;

    var formaction = btn.getAttribute('formaction') || '';
    var text = (btn.textContent || btn.value || '').trim();

    // Check if button is "Reset form to default values" or preset button
    var isResetButton = text.indexOf('Reset form to default values') !== -1 ||
                        text.indexOf('デフォルト値にリセット') !== -1;
    var isPresetButton = isResetButton ||
                         text.indexOf('Configure for minimal output') !== -1 ||
                         text.indexOf('Just create one local user account') !== -1;
    if (isPresetButton) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem('unattend_generator_session_state');
        } catch (re) {}
      }
    }

    // Check if button is "Import file"
    var isImportButton = text.indexOf('Import file') !== -1 ||
                         text.indexOf('ファイルのインポート') !== -1 ||
                         text.indexOf('XML設定の読込') !== -1 ||
                         text.indexOf('XMLを読込') !== -1 ||
                         text.indexOf('インポート') !== -1 ||
                         formaction.indexOf('import') !== -1 ||
                         (btn.form && btn.form.querySelector('#Upload'));

    if (isImportButton) {
      e.preventDefault();
      e.stopPropagation();
      var uploadInput = document.getElementById('Upload') || (btn.form && btn.form.querySelector('input[type="file"]'));
      if (uploadInput && uploadInput.files && uploadInput.files.length > 0) {
        importXmlFile(uploadInput.files[0], null, getMainForm());
      } else if (uploadInput) {
        alert('インポートするXMLファイルを選択してください。');
      } else {
        var fi = document.getElementById('engine_xml_file_input');
        if (!fi) {
          fi = document.createElement('input');
          fi.type = 'file';
          fi.id = 'engine_xml_file_input';
          fi.accept = '.xml,text/xml';
          fi.style.display = 'none';
          document.body.appendChild(fi);
          fi.addEventListener('change', function () {
            if (fi.files && fi.files.length > 0) {
              importXmlFile(fi.files[0], null, getMainForm());
            }
          });
        }
        fi.click();
      }
      return;
    }

    var action = null;
    if (formaction.indexOf('view') !== -1 || text.indexOf('表示') !== -1 || text.indexOf('View') !== -1) {
      action = 'view';
    } else if (formaction.indexOf('download') !== -1 || text.indexOf('ダウンロード') !== -1 || text.indexOf('Download') !== -1) {
      action = 'download';
    } else if (formaction.indexOf('iso') !== -1 || text.indexOf('ISO') !== -1) {
      action = 'iso';
    }

    if (action) {
      var formElem = btn.form || getMainForm();
      if (formElem) {
        var config = getConfig();
        if (config.mode !== 'server') {
          e.preventDefault();
          e.stopPropagation();
          handleEngineAction(action, formElem, btn);
        }
      }
    }
  }, true);

  // 2. Intercept form submit to prevent HTTP POST (405 error on static server)
  document.addEventListener('submit', function (e) {
    if (e.target && (e.target.querySelector('#Upload') || e.target.getAttribute('enctype') === 'multipart/form-data')) {
      e.preventDefault();
      e.stopPropagation();
      var uploadInput = e.target.querySelector('#Upload') || e.target.querySelector('input[type="file"]');
      if (uploadInput && uploadInput.files && uploadInput.files.length > 0) {
        importXmlFile(uploadInput.files[0], null, getMainForm());
      } else {
        alert('インポートするXMLファイルを選択してください。');
      }
    }
  }, true);

  // 3. Drag and drop XML import onto window
  window.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
  }, false);

  window.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      var file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.xml')) {
        e.preventDefault();
        e.stopPropagation();
        importXmlFile(file, null, getMainForm());
      }
    }
  }, false);

  // 4. Restore initial form state from URL query or sessionStorage fallback
  var hasSearch = typeof window !== 'undefined' && window.location && window.location.search && window.location.search.length > 1;
  var hasSession = false;
  try {
    hasSession = typeof window !== 'undefined' && window.sessionStorage && !!window.sessionStorage.getItem('unattend_generator_session_state');
  } catch (e) {
    hasSession = false;
  }
  if (hasSearch || hasSession) {
    var restoreAttempts = 0;
    var tryRestore = function () {
      restoreAttempts++;
      var mainForm = getMainForm();
      if (mainForm && mainForm.elements && mainForm.elements.length > 10) {
        restoreFromUrlQuery(mainForm);
      } else if (restoreAttempts < 50) {
        setTimeout(tryRestore, 100);
      }
    };
    tryRestore();
  } else {
    restoreFromUrlQuery();
  }

  // 5. Update header relative commit time
  updateHeaderCommitTime();
}

/**
 * Format relative time from commit ISO date string
 */
function formatRelativeTime(dateInput, nowInput) {
  if (!dateInput) return '';
  var commitDate = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(commitDate.getTime())) return '';
  var now = nowInput ? ((nowInput instanceof Date) ? nowInput : new Date(nowInput)) : new Date();
  var diffMs = now.getTime() - commitDate.getTime();
  if (isNaN(diffMs) || diffMs < 0) {
    diffMs = 0;
  }
  var diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return 'just now';
  }
  var diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1 ? 'updated 1 minute ago' : 'updated ' + diffMin + ' minutes ago';
  }
  var diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? 'updated 1 hour ago' : 'updated ' + diffHours + ' hours ago';
  }
  var diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return diffDays === 1 ? 'updated 1 day ago' : 'updated ' + diffDays + ' days ago';
  }
  var diffMonths = Math.floor(diffDays / 30);
  if (diffDays < 365) {
    return diffMonths === 1 ? 'updated 1 month ago' : 'updated ' + diffMonths + ' months ago';
  }
  var diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? 'updated 1 year ago' : 'updated ' + diffYears + ' years ago';
}

/**
 * Update the header commit relative time text in DOM
 */
function updateHeaderCommitTime() {
  if (typeof document === 'undefined') return;
  var elem = document.getElementById('header-commit-time');
  if (!elem) return;
  var dateStr = elem.getAttribute('data-commit-date');
  if (!dateStr && typeof COMMIT_DATE !== 'undefined') {
    dateStr = COMMIT_DATE;
  }
  if (dateStr) {
    var relText = formatRelativeTime(dateStr);
    if (relText) {
      elem.textContent = relText;
    }
  }
}


