/**
 * ISO 9660 image creator for browser-based download
 */
function createIsoBlob(filename, fileContentStr) {
  var SECTOR_SIZE = 2048;
  var encoder = new TextEncoder();
  var fileBytes = encoder.encode(fileContentStr);
  var fileSectors = Math.ceil(fileBytes.length / SECTOR_SIZE) || 1;
  var totalSectors = 16 + 1 + 1 + fileSectors + 1;
  var buffer = new Uint8Array(totalSectors * SECTOR_SIZE);

  var pvdOffset = 16 * SECTOR_SIZE;
  buffer[pvdOffset + 0] = 1;
  buffer.set(encoder.encode('CD001'), pvdOffset + 1);
  buffer[pvdOffset + 6] = 1;
  buffer.set(encoder.encode('WINDOWS                         '.substring(0, 32)), pvdOffset + 8);
  buffer.set(encoder.encode('UNATTEND                        '.substring(0, 32)), pvdOffset + 40);

  var rootDirOffset = pvdOffset + 156;
  buffer[rootDirOffset + 0] = 34;
  buffer[rootDirOffset + 2] = 18;
  buffer[rootDirOffset + 6] = 18;
  buffer[rootDirOffset + 10] = 2048 & 0xff;
  buffer[rootDirOffset + 11] = (2048 >> 8) & 0xff;
  buffer[rootDirOffset + 25] = 2;

  var termOffset = 17 * SECTOR_SIZE;
  buffer[termOffset + 0] = 255;
  buffer.set(encoder.encode('CD001'), termOffset + 1);
  buffer[termOffset + 6] = 1;

  var fileSector = 19;
  buffer.set(fileBytes, fileSector * SECTOR_SIZE);

  var ptr = 18 * SECTOR_SIZE;
  buffer[ptr + 0] = 34; buffer[ptr + 2] = 18; buffer[ptr + 10] = 2048 & 0xff; buffer[ptr + 25] = 2; buffer[ptr + 32] = 1; buffer[ptr + 33] = 0;
  ptr += 34;
  buffer[ptr + 0] = 34; buffer[ptr + 2] = 18; buffer[ptr + 10] = 2048 & 0xff; buffer[ptr + 25] = 2; buffer[ptr + 32] = 1; buffer[ptr + 33] = 1;
  ptr += 34;

  var isoName = (filename + ';1').toUpperCase();
  var recLen = 33 + isoName.length + (isoName.length % 2 === 0 ? 1 : 0);
  buffer[ptr + 0] = recLen;
  buffer[ptr + 2] = fileSector & 0xff;
  buffer[ptr + 3] = (fileSector >> 8) & 0xff;
  buffer[ptr + 10] = fileBytes.length & 0xff;
  buffer[ptr + 11] = (fileBytes.length >> 8) & 0xff;
  buffer[ptr + 25] = 0;
  buffer[ptr + 32] = isoName.length;
  buffer.set(encoder.encode(isoName), ptr + 33);

  return new Blob([buffer], { type: 'application/x-iso9660-image' });
}
