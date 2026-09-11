/**
 * XML Node formatting and DOM representation matching C# XmlDocument
 */
function escapeXmlText(text) {
  if (text == null) return '';
  var str = String(text);
  var res = '';
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c === 38) { // &
      res += '&amp;';
    } else if (c === 60) { // <
      res += '&lt;';
    } else if (c === 62) { // >
      res += '&gt;';
    } else if (c > 127) {
      // Non-ASCII character -> numeric entity for ASCII-safe XML
      res += '&#' + 'x' + c.toString(16).toUpperCase() + ';';
    } else {
      res += str.charAt(i);
    }
  }
  return res;
}

function escapeXmlAttr(text) {
  if (text == null) return '';
  var str = String(text);
  var res = '';
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c === 38) {
      res += '&amp;';
    } else if (c === 60) {
      res += '&lt;';
    } else if (c === 62) {
      res += '&gt;';
    } else if (c === 34) {
      res += '&quot;';
    } else if (c === 39) {
      res += '&apos;';
    } else if (c > 127) {
      res += '&#' + 'x' + c.toString(16).toUpperCase() + ';';
    } else {
      res += str.charAt(i);
    }
  }
  return res;
}

// XML Node Data Structure
function XmlNode(name, attrs, children, isText) {
  this.name = name || '';
  this.attrs = attrs || {};
  this.children = children || [];
  this.isText = !!isText;
  this.textValue = isText ? (name || '') : '';
}

XmlNode.prototype.addChild = function (child) {
  this.children.push(child);
  return child;
};

XmlNode.prototype.addSimpleElement = function (name, text) {
  var elem = new XmlNode(name);
  elem.addChild(new XmlNode(text != null ? String(text) : '', null, null, true));
  this.children.push(elem);
  return elem;
};

XmlNode.prototype.find = function (name) {
  for (var i = 0; i < this.children.length; i++) {
    if (!this.children[i].isText && this.children[i].name === name) {
      return this.children[i];
    }
  }
  return null;
};

XmlNode.prototype.serialize = function (depth) {
  var indent = '';
  for (var i = 0; i < depth; i++) {
    indent += '\t';
  }

  if (this.isText) {
    return escapeXmlText(this.textValue);
  }

  var attrStr = '';
  for (var key in this.attrs) {
    if (Object.prototype.hasOwnProperty.call(this.attrs, key)) {
      attrStr += ' ' + key + '="' + escapeXmlAttr(this.attrs[key]) + '"';
    }
  }

  if (this.children.length === 0) {
    return indent + '<' + this.name + attrStr + '></' + this.name + '>';
  }

  if (this.children.length === 1 && this.children[0].isText) {
    var txt = this.children[0].textValue;
    if (this.name !== 'File' && this.name !== 'ExtractScript' && txt.indexOf('\n') === -1) {
      return indent + '<' + this.name + attrStr + '>' + escapeXmlText(txt) + '</' + this.name + '>';
    } else {
      var cleanTxt = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      var lines = cleanTxt ? cleanTxt.split('\n') : [];
      var res = indent + '<' + this.name + attrStr + '>\r\n';
      for (var j = 0; j < lines.length; j++) {
        res += escapeXmlText(lines[j]) + '\r\n';
      }
      res += indent + '</' + this.name + '>';
      return res;
    }
  }

  var result = indent + '<' + this.name + attrStr + '>\r\n';
  for (var k = 0; k < this.children.length; k++) {
    var childRes = this.children[k].serialize(depth + 1);
    if (childRes.length > 0) {
      result += childRes + '\r\n';
    }
  }
  result += indent + '</' + this.name + '>';
  return result;
};
