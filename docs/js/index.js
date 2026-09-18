/**
 * UnattendEngine Entry Point & Exporter
 */

// Auto-init on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEngine);
  } else {
    initEngine();
  }
}

// Export public API
var unattendEngine = {
  getConfig: getConfig,
  getMainForm: getMainForm,
  generateAutounattendXml: generateAutounattendXml,
  createIsoBlob: createIsoBlob,
  handleEngineAction: handleEngineAction,
  extractQueryFromXml: extractQueryFromXml,
  applyQueryToForm: applyQueryToForm,
  applyXmlDomToForm: applyXmlDomToForm,
  overrideFormFromXmlDom: overrideFormFromXmlDom,
  importXmlFile: importXmlFile,
  restoreFromUrlQuery: restoreFromUrlQuery,
  formatRelativeTime: formatRelativeTime,
  updateHeaderCommitTime: updateHeaderCommitTime
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = unattendEngine;
} else {
  (typeof window !== 'undefined' ? window : globalThis).UnattendEngine = unattendEngine;
}
