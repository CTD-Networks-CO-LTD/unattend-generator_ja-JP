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
        if (ok && typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '?' + finalQuery);
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


// Restore form state from window.location.search
function restoreFromUrlQuery(targetForm) {
  if (typeof window === 'undefined' || !window.location || !window.location.search) {
    return false;
  }
  var search = window.location.search;
  if (search.length > 1) {
    return applyQueryToForm(search, targetForm || getMainForm());
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

    // Check if button is "Import file"
    if (text.indexOf('XML設定の読込') !== -1 || text.indexOf('XMLを読込') !== -1 || text.indexOf('インポート') !== -1 || formaction.indexOf('import') !== -1) {
      e.preventDefault();
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
          handleEngineAction(action, formElem, btn);
        }
      }
    }
  }, true);

  // 2. Drag and drop XML import onto window
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

  // 3. Restore initial form state from URL query if present
  restoreFromUrlQuery();
}

