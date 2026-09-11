/**
 * Configuration manager for unattend-generator
 */
function getConfig() {
  var config = Object.assign({
    mode: 'client',
    serverEndpoint: '',
    allowUrlOverride: true
  }, (typeof window !== 'undefined' && window.UNATTEND_CONFIG) || {});

  if (config.allowUrlOverride && typeof window !== 'undefined' && window.location) {
    var params = new URLSearchParams(window.location.search);
    var engineParam = params.get('engine');
    var apiParam = params.get('api');
    if (engineParam === 'client' || engineParam === 'server') {
      config.mode = engineParam;
    }
    if (apiParam) {
      config.serverEndpoint = apiParam.replace(/\/+$/, '');
    }
  }
  return config;
}
