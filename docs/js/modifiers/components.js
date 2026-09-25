/**
 * Components modifier matching C# ComponentsModifier
 * Injects custom XML markup into specified components across setup passes
 */

function unescapeXml(str) {
  if (!str) return '';
  return str.replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) { return String.fromCharCode(parseInt(hex, 16)); })
            .replace(/&#([0-9]+);/g, function (_, dec) { return String.fromCharCode(parseInt(dec, 10)); });
}

function parseAttributes(attrStr) {
  var attrs = {};
  if (!attrStr) return attrs;
  var attrRegex = /([a-zA-Z0-9_\-:]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'">=]+))/g;
  var m;
  while ((m = attrRegex.exec(attrStr)) !== null) {
    attrs[m[1]] = unescapeXml(m[2] != null ? m[2] : (m[3] != null ? m[3] : m[4]));
  }
  return attrs;
}

function domNodeToXmlNode(domNode) {
  if (domNode.nodeType === 3) {
    var val = domNode.nodeValue;
    return val && val.trim().length > 0 ? new XmlNode(val, null, null, true) : null;
  }
  if (domNode.nodeType === 1) {
    var attrs = {};
    for (var a = 0; a < domNode.attributes.length; a++) {
      attrs[domNode.attributes[a].name] = domNode.attributes[a].value;
    }
    var node = new XmlNode(domNode.tagName, attrs);
    for (var c = 0; c < domNode.childNodes.length; c++) {
      var child = domNodeToXmlNode(domNode.childNodes[c]);
      if (child) node.addChild(child);
    }
    return node;
  }
  return null;
}

function parseXmlMarkupFallback(xmlStr) {
  var wrapped = '<root xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">' + xmlStr + '</root>';
  var rootNode = new XmlNode('root');
  var stack = [rootNode];

  var tagRegex = /<(\/)?([a-zA-Z0-9_\-:]+)((?:\s+[^'">\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+))?)*)\s*(\/)?>/g;
  var lastIdx = 0;
  var match;

  while ((match = tagRegex.exec(wrapped)) !== null) {
    var textBefore = wrapped.substring(lastIdx, match.index);
    if (textBefore.trim().length > 0) {
      stack[stack.length - 1].addChild(new XmlNode(unescapeXml(textBefore), null, null, true));
    }
    lastIdx = tagRegex.lastIndex;

    var isClosing = !!match[1];
    var tagName = match[2];
    var attrStr = match[3];
    var isSelfClosing = !!match[4];

    if (isClosing) {
      if (stack.length <= 1) throw new Error('Mismatched closing tag: ' + tagName);
      var popped = stack.pop();
      if (popped.name !== tagName) throw new Error('Tag mismatch: expected ' + popped.name + ' but got ' + tagName);
    } else {
      var attrs = parseAttributes(attrStr);
      var newNode = new XmlNode(tagName, attrs);
      stack[stack.length - 1].addChild(newNode);
      if (!isSelfClosing) stack.push(newNode);
    }
  }

  if (stack.length !== 1) throw new Error('Unclosed tags in XML markup');
  return rootNode.children;
}

function parseXmlMarkup(xmlStr) {
  if (typeof DOMParser !== 'undefined') {
    try {
      var wrapped = '<root xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">' + xmlStr + '</root>';
      var parser = new DOMParser();
      var dom = parser.parseFromString(wrapped, 'application/xml');
      if (!dom.querySelector('parsererror')) {
        var domChildren = dom.documentElement.childNodes;
        var result = [];
        for (var i = 0; i < domChildren.length; i++) {
          var converted = domNodeToXmlNode(domChildren[i]);
          if (converted) result.push(converted);
        }
        return result;
      }
    } catch (e) {
      // Fallback
    }
  }
  return parseXmlMarkupFallback(xmlStr);
}

function hasForbiddenElements(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (!n.isText) {
      var localName = n.name.indexOf(':') !== -1 ? n.name.split(':')[1] : n.name;
      if (localName.toLowerCase() === 'settings' || localName.toLowerCase() === 'component') {
        return true;
      }
      if (n.children && hasForbiddenElements(n.children)) {
        return true;
      }
    }
  }
  return false;
}

function ComponentsModifier(context) {
  this.context = context;
  this.components = [];
}

ComponentsModifier.prototype.process = function () {
  var ctx = this.context;
  this.components = [];

  for (var i = 0; i <= 2; i++) {
    var compVal = ctx.getVal('Component' + i, '');
    var compMarkup = ctx.getVal('ComponentContent' + i, '');

    if (!compVal || !compMarkup || !compMarkup.trim()) {
      continue;
    }

    var lastDash = compVal.lastIndexOf('-');
    if (lastDash === -1) {
      continue;
    }

    var compName = compVal.substring(0, lastDash);
    var passName = compVal.substring(lastDash + 1);

    try {
      var parsedNodes = parseXmlMarkup(compMarkup.trim());
      if (hasForbiddenElements(parsedNodes)) {
        console.warn('Component markup contains forbidden elements (settings or component). Skipped.');
        continue;
      }
      this.components.push({
        pass: passName,
        component: compName,
        nodes: parsedNodes
      });
    } catch (e) {
      console.warn('Invalid XML markup in ComponentContent' + i + ': ' + e.message);
    }
  }
  ctx.customComponents = this.components;
};

ComponentsModifier.prototype.applyToPasses = function (passSettings) {
  for (var i = 0; i < this.components.length; i++) {
    var item = this.components[i];
    var setting = passSettings[item.pass];
    if (!setting) {
      continue;
    }

    var existingComponent = null;
    for (var c = 0; c < setting.children.length; c++) {
      var child = setting.children[c];
      if (!child.isText && child.name === 'component' && child.attrs && child.attrs.name === item.component) {
        existingComponent = child;
        break;
      }
    }

    var targetComp = existingComponent;
    if (!targetComp) {
      targetComp = new XmlNode('component', {
        'name': item.component,
        'processorArchitecture': 'x86',
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      });
      setting.addChild(targetComp);
    } else {
      targetComp.children = [];
    }

    for (var n = 0; n < item.nodes.length; n++) {
      targetComp.addChild(item.nodes[n]);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ComponentsModifier: ComponentsModifier,
    parseXmlMarkup: parseXmlMarkup
  };
}

