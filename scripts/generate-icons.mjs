import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const pngCrcTable = new Uint32Array(256)
for (let byte = 0; byte < 256; byte += 1) {
  let value = byte
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  pngCrcTable[byte] = value >>> 0
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = pngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(name, data) {
  const type = Buffer.from(name)
  const body = Buffer.concat([type, data])
  const header = Buffer.alloc(4)
  header.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([header, body, checksum])
}

function createIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4)
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = (y * size + x) * 4
    pixels[offset] = color[0]
    pixels[offset + 1] = color[1]
    pixels[offset + 2] = color[2]
    pixels[offset + 3] = 255
  }
  const rectangle = (x, y, width, height, color) => {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) setPixel(column, row, color)
    }
  }
  const scale = size / 512
  const px = (value) => Math.round(value * scale)
  const red = [231, 0, 11]
  const paleRed = [255, 223, 224]
  const white = [255, 255, 255]
  rectangle(0, 0, size, size, red)

  const page = maskable ? { x: 160, y: 106, width: 212, height: 300, fold: 70 } : { x: 128, y: 64, width: 256, height: 384, fold: 88 }
  rectangle(px(page.x), px(page.y), px(page.width), px(page.height), white)
  rectangle(px(page.x + page.width - page.fold), px(page.y), px(page.fold), px(page.fold), paleRed)
  rectangle(px(page.x + page.width - page.fold), px(page.y), px(6), px(page.fold), red)
  rectangle(px(page.x + page.width - page.fold), px(page.y + page.fold - 6), px(page.fold), px(6), red)

  const lineX = px(page.x + (maskable ? 30 : 43))
  const lineWidth = px(maskable ? 151 : 171)
  const lineHeight = px(maskable ? 15 : 22)
  const firstLineY = px(page.y + (maskable ? 126 : 150))
  for (let row = 0; row < 3; row += 1) rectangle(lineX, firstLineY + px(row * (maskable ? 50 : 54)), lineWidth, lineHeight, red)
  rectangle(lineX, px(page.y + (maskable ? 276 : 324)), px(maskable ? 92 : 102), lineHeight, red)

  const scanlines = Buffer.alloc((size * 4 + 1) * size)
  for (let row = 0; row < size; row += 1) pixels.copy(scanlines, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const compressed = deflateSync(scanlines, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/pwa-192.png', createIcon(192, false))
writeFileSync('public/pwa-512.png', createIcon(512, false))
writeFileSync('public/pwa-192x192.png', createIcon(192, false))
writeFileSync('public/pwa-512x512.png', createIcon(512, false))
writeFileSync('public/apple-touch-icon.png', createIcon(180, false))
writeFileSync('public/pwa-maskable-512.png', createIcon(512, true))