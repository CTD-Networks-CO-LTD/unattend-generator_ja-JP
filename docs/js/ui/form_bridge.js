/**
 * Form Bridge: Handles form extraction, query-string sync, and XML DOM parsing/mapping
 */

// Helper to reliably find the main configuration form (holding #main-table and inputs)
function getMainForm() {
  if (typeof document === 'undefined') return null;
  var mainTable = document.getElementById('main-table');
  if (mainTable) {
    var parentForm = mainTable.closest('form');
    if (parentForm) return parentForm;
  }
  var langElem = document.querySelector('input[name="LanguageMode"], select[name="Locale"], select[name="ProcessorArchitecture"]');
  if (langElem && langElem.form) {
    return langElem.form;
  }
  var forms = document.querySelectorAll('form');
  var bestForm = null;
  var maxElements = 0;
  for (var i = 0; i < forms.length; i++) {
    if (forms[i].elements && forms[i].elements.length > maxElements) {
      maxElements = forms[i].elements.length;
      bestForm = forms[i];
    }
  }
  return bestForm || document.querySelector('form');
}

// Extract query string parameter embedded in XML comment <!-- https://...?key=value -->
function extractQueryFromXml(xmlText) {
  if (!xmlText) return null;
  var commentMatch = xmlText.match(/<!--\s*https?:\/\/[^?]*?\?([\s\S]*?)-->/);
  if (commentMatch && commentMatch[1]) {
    return commentMatch[1].trim();
  }
  return null;
}

// Apply parsed query parameters to form inputs
function applyQueryToForm(queryString, targetForm) {
  if (!queryString || typeof document === 'undefined') return false;

  if (queryString.indexOf('?') === 0) {
    queryString = queryString.substring(1);
  }

  var params = new URLSearchParams(queryString);
  var form = targetForm || getMainForm();
  if (!form) return false;

  // 1. Radio buttons
  var radios = form.querySelectorAll('input[type="radio"][name]');
  radios.forEach(function (rb) {
    var name = rb.name;
    if (params.has(name)) {
      var val = params.get(name);
      if (rb.value === val) {
        rb.checked = true;
        rb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // 2. Checkboxes
  var checkboxes = form.querySelectorAll('input[type="checkbox"][name]');
  checkboxes.forEach(function (cb) {
    var name = cb.name;
    var isChecked = false;
    if (params.has(name)) {
      var val = params.get(name);
      isChecked = (val === 'true' || val === 'on' || val === '' || val === cb.value);
    }
    cb.checked = isChecked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // 3. Account names first
  var accountNames = form.querySelectorAll('input[name^="AccountName"]');
  accountNames.forEach(function (input) {
    var name = input.name;
    var val = params.has(name) ? params.get(name) : '';
    input.value = val;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // 4. Select boxes
  var selects = form.querySelectorAll('select[name]');
  selects.forEach(function (sel) {
    var name = sel.name;
    if (params.has(name)) {
      if (sel.multiple) {
        var allVals = params.getAll(name);
        for (var i = 0; i < sel.options.length; i++) {
          sel.options[i].selected = allVals.indexOf(sel.options[i].value) !== -1;
        }
      } else {
        var val = params.get(name);
        sel.value = val;
      }
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 5. Text / textarea / password inputs
  var textInputs = form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]), textarea');
  textInputs.forEach(function (input) {
    var name = input.name;
    if (name && name.indexOf('AccountName') !== 0 && params.has(name)) {
      var val = params.get(name);
      input.value = val;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 6. Dependent / sequential controls
  var dependentKeys = ['Keyboard', 'GeoLocation', 'Keyboard2', 'Keyboard3', 'AccountGroup0', 'AccountGroup1', 'AccountGroup2', 'AccountGroup3', 'AccountGroup4', 'AccountGroup5', 'AccountGroup6', 'AccountGroup7', 'AccountGroup8', 'AccountGroup9'];
  dependentKeys.forEach(function (key) {
    if (params.has(key)) {
      var el = form.querySelector('select[name="' + key + '"], input[name="' + key + '"]');
      if (el) {
        el.value = params.get(key);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  return true;
}


// Fallback: parse XML DOM when comment query string is absent
function applyXmlDomToForm(xmlDoc, targetForm) {
  if (!xmlDoc || typeof document === 'undefined') return false;

  var form = targetForm || getMainForm();
  if (!form) return false;

  // UILanguage / Locale
  var uiLang = xmlDoc.querySelector('UILanguage');
  if (uiLang && uiLang.textContent) {
    var langVal = uiLang.textContent.trim();
    var selLocale = form.querySelector('select[name="Locale"]');
    if (selLocale) {
      selLocale.value = langVal;
      selLocale.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // InputLocale / Keyboard
  var inputLocale = xmlDoc.querySelector('InputLocale');
  if (inputLocale && inputLocale.textContent) {
    var inLocText = inputLocale.textContent.trim();
    var parts = inLocText.split(':');
    var kbCode = parts.length > 1 ? parts[1] : parts[0];
    var selKb = form.querySelector('select[name="Keyboard"]');
    if (selKb) {
      selKb.value = kbCode;
      selKb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // GeoLocation
  var geoLoc = xmlDoc.querySelector('GeoLocation');
  if (geoLoc && geoLoc.textContent) {
    var selGeo = form.querySelector('select[name="GeoLocation"]');
    if (selGeo) {
      selGeo.value = geoLoc.textContent.trim();
      selGeo.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ProcessorArchitecture
  var comp = xmlDoc.querySelector('component[processorArchitecture]');
  if (comp) {
    var archVal = comp.getAttribute('processorArchitecture');
    var selArch = form.querySelector('select[name="ProcessorArchitecture"]');
    if (selArch) {
      selArch.value = archVal;
      selArch.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ComputerName
  var compName = xmlDoc.querySelector('ComputerName');
  if (compName && compName.textContent) {
    var compNameVal = compName.textContent.trim();
    var rCompCustom = form.querySelector('input[name="ComputerNameMode"][value="Custom"]');
    if (rCompCustom) {
      rCompCustom.checked = true;
      rCompCustom.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var inpCompName = form.querySelector('input[name="ComputerName"]');
    if (inpCompName) {
      inpCompName.value = compNameVal;
      inpCompName.dispatchEvent(new Event('input', { bubbles: true }));
      inpCompName.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // TimeZone
  var timeZone = xmlDoc.querySelector('TimeZone');
  if (timeZone && timeZone.textContent) {
    var tzVal = timeZone.textContent.trim();
    var rTzExplicit = form.querySelector('input[name="TimeZoneMode"][value="Explicit"]');
    if (rTzExplicit) {
      rTzExplicit.checked = true;
      rTzExplicit.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var tzSel = form.querySelector('select[name="TimeZone"]');
    if (tzSel) {
      tzSel.value = tzVal;
      tzSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // LocalAccounts
  var localAccs = xmlDoc.querySelectorAll('LocalAccount');
  if (localAccs && localAccs.length > 0) {
    var rAccUnattended = form.querySelector('input[name="UserAccountMode"][value="Unattended"]');
    if (rAccUnattended) {
      rAccUnattended.checked = true;
      rAccUnattended.dispatchEvent(new Event('change', { bubbles: true }));
    }
    localAccs.forEach(function (acc, idx) {
      var name = acc.querySelector('Name') ? acc.querySelector('Name').textContent.trim() : '';
      var disp = acc.querySelector('DisplayName') ? acc.querySelector('DisplayName').textContent.trim() : '';
      var grp = acc.querySelector('Group') ? acc.querySelector('Group').textContent.trim() : '';
      var passElem = acc.querySelector('Password > Value');
      var pass = passElem ? passElem.textContent.trim() : '';

      if (name) {
        var nameInp = form.querySelector('input[name="AccountName' + idx + '"]');
        if (nameInp) {
          nameInp.value = name;
          nameInp.dispatchEvent(new Event('input', { bubbles: true }));
          nameInp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (disp) {
        var dispInp = form.querySelector('input[name="AccountDisplayName' + idx + '"]');
        if (dispInp) {
          dispInp.value = disp;
          dispInp.dispatchEvent(new Event('input', { bubbles: true }));
          dispInp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (grp) {
        var grpSel = form.querySelector('select[name="AccountGroup' + idx + '"]');
        if (grpSel) {
          grpSel.value = grp;
          grpSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (passElem) {
        var passInp = form.querySelector('input[name="AccountPassword' + idx + '"]');
        if (passInp) {
          passInp.value = pass;
          passInp.dispatchEvent(new Event('input', { bubbles: true }));
          passInp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  return true;
}


// Override form values with actual XML DOM elements (prioritizing XML body over comment query)
function overrideFormFromXmlDom(xmlDoc, targetForm, params) {
  if (!xmlDoc || typeof document === 'undefined') return false;

  var form = targetForm || getMainForm();
  if (!form) return false;

  // 1. LocalAccounts: override account names, display names, groups, and passwords from XML body
  var localAccs = xmlDoc.querySelectorAll('LocalAccount');
  if (localAccs && localAccs.length > 0) {
    var rAccUnattended = form.querySelector('input[name="UserAccountMode"][value="Unattended"]');
    if (rAccUnattended && !rAccUnattended.checked) {
      rAccUnattended.checked = true;
      rAccUnattended.dispatchEvent(new Event('change', { bubbles: true }));
      if (params) params.set('UserAccountMode', 'Unattended');
    }

    localAccs.forEach(function (acc, idx) {
      var nameElem = acc.querySelector('Name');
      var dispElem = acc.querySelector('DisplayName');
      var grpElem = acc.querySelector('Group');
      var passElem = acc.querySelector('Password > Value');

      if (nameElem) {
        var name = nameElem.textContent ? nameElem.textContent.trim() : '';
        var nameInp = form.querySelector('input[name="AccountName' + idx + '"]');
        if (nameInp) {
          nameInp.value = name;
          nameInp.dispatchEvent(new Event('input', { bubbles: true }));
          nameInp.dispatchEvent(new Event('change', { bubbles: true }));
          if (params) params.set('AccountName' + idx, name);
        }
      }

      if (dispElem) {
        var disp = dispElem.textContent ? dispElem.textContent.trim() : '';
        var dispInp = form.querySelector('input[name="AccountDisplayName' + idx + '"]');
        if (dispInp) {
          dispInp.value = disp;
          dispInp.dispatchEvent(new Event('input', { bubbles: true }));
          dispInp.dispatchEvent(new Event('change', { bubbles: true }));
          if (params) params.set('AccountDisplayName' + idx, disp);
        }
      }

      if (grpElem) {
        var grp = grpElem.textContent ? grpElem.textContent.trim() : '';
        var grpSel = form.querySelector('select[name="AccountGroup' + idx + '"]');
        if (grpSel) {
          grpSel.value = grp;
          grpSel.dispatchEvent(new Event('change', { bubbles: true }));
          if (params) params.set('AccountGroup' + idx, grp);
        }
      }

      if (passElem) {
        var pass = passElem.textContent ? passElem.textContent.trim() : '';
        var passInp = form.querySelector('input[name="AccountPassword' + idx + '"]');
        if (passInp) {
          passInp.value = pass;
          passInp.dispatchEvent(new Event('input', { bubbles: true }));
          passInp.dispatchEvent(new Event('change', { bubbles: true }));
          if (params) params.set('AccountPassword' + idx, pass);
        }
      }
    });
  }

  // 2. ProductKey: override ProductKey value and Windows edition selection if present
  var keyElem = xmlDoc.querySelector('UserData > ProductKey > Key');
  if (keyElem && keyElem.textContent) {
    var prodKey = keyElem.textContent.trim();
    var rCustom = form.querySelector('input[name="WindowsEditionMode"][value="Custom"]');
    if (rCustom) {
      rCustom.checked = true;
      rCustom.dispatchEvent(new Event('change', { bubbles: true }));
      if (params) params.set('WindowsEditionMode', 'Custom');
    }
    var keyInp = form.querySelector('input[name="ProductKey"]');
    if (keyInp) {
      keyInp.value = prodKey;
      keyInp.dispatchEvent(new Event('input', { bubbles: true }));
      keyInp.dispatchEvent(new Event('change', { bubbles: true }));
      if (params) params.set('ProductKey', prodKey);
    }
  }

  return true;
}


